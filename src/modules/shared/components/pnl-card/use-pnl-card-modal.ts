import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useThemeContext } from '@/modules/shared/providers/theme-provider'
import { logger } from '@/app/logger'
import { createPnlCardArtPrefsStore } from '@/modules/shared/services/pnl-card-art-prefs-store'
import { usePnlCardExport } from './use-pnl-card-export'
import { usePnlCardCaptureIcon } from './use-pnl-card-capture-icon'
import { collectibleKeyOf, reachableArtKeys, stepRing } from './pnl-card.utils'
import {
  CARD_ART,
  DEFAULT_ART_SELECTION,
  EXPORT_WIDTH,
  MASCOTS,
  MASCOT_LABELS,
  PLANETS,
  PLANET_LABELS,
} from './pnl-card.constants'
import type {
  PnlCardArtSelection,
  PnlCardArtTheme,
  PnlHeroDisplay,
  StepDirection,
  UsePnlCardModalArgs,
  UsePnlCardModalReturn,
} from './pnl-card.types'

const log = logger.child({ module: 'use-pnl-card-modal' })

/**
 * State owner for `PnlCardModal` (PnL Card v2). Owns the %↔$ hero toggle, the live
 * collectible art selection (planet × mascot × theme), its localStorage
 * persistence, the responsive preview scale (measured against the viewport width —
 * the card itself is always captured at its natural 1080px), and the export
 * handlers. The card node is the single capture target; `modern-screenshot`
 * ignores the ancestor preview transform, so one node serves the on-screen preview
 * and the PNG.
 */
export function usePnlCardModal({ view }: UsePnlCardModalArgs): UsePnlCardModalReturn {
  const { theme: appTheme } = useThemeContext()
  // App theme → art theme: app `dark` → `dark`, app `white` → `light`.
  const appArtTheme: PnlCardArtTheme = appTheme === 'dark' ? 'dark' : 'light'

  const cardRef = useRef<HTMLDivElement | null>(null)
  const previewObserverRef = useRef<ResizeObserver | null>(null)
  const [displayMode, setDisplayMode] = useState<PnlHeroDisplay>('pct')
  const [selection, setSelection] = useState<PnlCardArtSelection>(DEFAULT_ART_SELECTION)
  const [displayedSelection, setDisplayedSelection] =
    useState<PnlCardArtSelection>(DEFAULT_ART_SELECTION)
  const [previewScale, setPreviewScale] = useState(1)
  const wasOpenRef = useRef(false)
  const warmedArtKeysRef = useRef<Set<string>>(new Set())

  // Build the persistence store once — never rebuilt across renders.
  const store = useMemo(() => createPnlCardArtPrefsStore({ logger }), [])

  // Persist the selection (fire-and-forget; log on failure — never blocks the UI).
  const persist = useCallback(
    (next: PnlCardArtSelection) => {
      const saved = store.save(next)
      if (saved.isErr()) {
        log.warn({ errorMessage: String(saved.error.cause) }, 'persist art prefs failed')
      }
    },
    [store],
  )

  // Seed the selection on each open (null → view). Not on every render: while the
  // modal stays open, manual picks must stick. Use persisted picks when present,
  // else the default with its theme overridden by the current app theme.
  useEffect(() => {
    const isOpen = view !== null
    const justOpened = isOpen && !wasOpenRef.current
    wasOpenRef.current = isOpen
    if (!justOpened) return
    const loaded = store.load()
    const persisted = loaded.isOk() ? loaded.value : null
    const seeded: PnlCardArtSelection = persisted ?? { ...DEFAULT_ART_SELECTION, theme: appArtTheme }
    setSelection(seeded)
  }, [view, appArtTheme, store])

  // Decode-gate the art swap: the card keeps wearing the previous collectible
  // until the target PNG is fully decoded, so stepping never flashes a blank
  // card while ~850 KB downloads (a raw `background-image` change paints
  // nothing until the new image arrives). With the warm set below the decode
  // is usually already done and the swap reads as instant. Rapid stepping is
  // safe — each change cancels the previous pending apply, so only the latest
  // pick ever lands.
  useEffect(() => {
    let cancelled = false
    const image = new Image()
    image.src = CARD_ART[collectibleKeyOf(selection)]
    const apply = () => {
      if (!cancelled) setDisplayedSelection(selection)
    }
    // jsdom has no `decode()` — swap immediately there (tests stay sync).
    if (typeof image.decode !== 'function') {
      apply()
      return
    }
    image.decode().then(apply, apply)
    return () => {
      cancelled = true
    }
  }, [selection])

  // Warm every collectible reachable in one picker interaction (planet ring,
  // mascot ring, opposite theme) so the next click's PNG is already in the
  // browser cache. Scoped to ~11 keys for the current selection — never the
  // full 48 (~40 MB), which would saturate the connection pool and queue the
  // visible card background + the capture-icon fetch behind a surprise bulk
  // download. Fire-and-forget decode-async fetches, deduped per session.
  useEffect(() => {
    if (view === null) return
    for (const key of reachableArtKeys(selection)) {
      if (warmedArtKeysRef.current.has(key)) continue
      warmedArtKeysRef.current.add(key)
      const image = new Image()
      image.decoding = 'async'
      image.src = CARD_ART[key]
    }
  }, [view, selection])

  const onStepPlanet = useCallback(
    (dir: StepDirection) => {
      const next: PnlCardArtSelection = { ...selection, planet: stepRing(PLANETS, selection.planet, dir) }
      setSelection(next)
      persist(next)
    },
    [selection, persist],
  )

  const onStepMascot = useCallback(
    (dir: StepDirection) => {
      const next: PnlCardArtSelection = { ...selection, mascot: stepRing(MASCOTS, selection.mascot, dir) }
      setSelection(next)
      persist(next)
    },
    [selection, persist],
  )

  const onSetTheme = useCallback(
    (theme: PnlCardArtTheme) => {
      const next: PnlCardArtSelection = { ...selection, theme }
      setSelection(next)
      persist(next)
    },
    [selection, persist],
  )

  const canToggle = view !== null && view.heroPctLabel !== null
  // Degraded cards have no derivable ROE → always render the $ figure, ignoring
  // the toggle state (derived, not an effect — keeps the card honest on reopen).
  const effectiveDisplayMode: PnlHeroDisplay = canToggle ? displayMode : 'usd'

  // Callback ref: track the preview container width → scale factor for the
  // natural-size card. A callback ref re-runs on every mount, so the observer
  // re-attaches whenever the viewport node is (re)created — e.g. the Modal↔Sheet
  // swap when the layout crosses the mobile breakpoint. Measuring synchronously
  // here (getBoundingClientRect) avoids the transient 0 a freshly-inserted node
  // can hand the observer's first callback (which would scale the card to
  // nothing); we also ignore any 0-width reading so a good scale is never lost.
  const previewViewportRef = useCallback((node: HTMLDivElement | null) => {
    previewObserverRef.current?.disconnect()
    if (node === null) return
    const applyWidth = (width: number) => {
      if (width > 0) setPreviewScale(width / EXPORT_WIDTH)
    }
    applyWidth(node.getBoundingClientRect().width)
    const observer = new ResizeObserver((entries) => {
      applyWidth(entries[0]?.contentRect.width ?? node.clientWidth)
    })
    observer.observe(node)
    previewObserverRef.current = observer
  }, [])

  const exportApi = usePnlCardExport({ view, cardRef })
  const { iconDataUrl, isIconResolving } = usePnlCardCaptureIcon(view)

  return {
    displayMode: effectiveDisplayMode,
    setDisplayMode,
    selection,
    displayedSelection,
    iconDataUrl,
    isIconResolving,
    onStepPlanet,
    onStepMascot,
    onSetTheme,
    planetLabel: PLANET_LABELS[selection.planet],
    mascotLabel: MASCOT_LABELS[selection.mascot],
    canToggle,
    cardRef,
    previewViewportRef,
    previewScale,
    isExporting: exportApi.isExporting,
    onShareNative: exportApi.onShareNative,
    onDownload: exportApi.onDownload,
    onCopyImage: exportApi.onCopyImage,
    onCopyLink: exportApi.onCopyLink,
    onShareToX: exportApi.onShareToX,
    onShareToTelegram: exportApi.onShareToTelegram,
  }
}
