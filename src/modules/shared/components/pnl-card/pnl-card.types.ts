import type { RefObject } from 'react'
import type { PnlPctSign } from '@/modules/shared/utils/format-pnl'
import type { Market } from '@/modules/shared/domain'

/** Which side the trade was on. Drives the LONG/SHORT pill only — it no longer
 *  selects the background artwork (that is planet × mascot × theme now). */
export type PnlCardSide = 'long' | 'short'

/**
 * The collectible artwork axes (PnL Card v2). The background PNG is chosen by
 * `planet × mascot × theme`; the 48 bundled composites are keyed
 * `${planet}-${mascot}-${theme}` (see `CARD_ART`). The brand handle
 * (`@invaderstrade`) and the `MASCOT × PLANET` collectible tag are baked into
 * the art — the card overlays only the live trade data.
 */
export type PnlCardPlanet =
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'

export type PnlCardMascot = 'bug' | 'cat' | 'dino'

/** Art theme — matches the `-dark` / `-light` PNG suffixes and drives the ink
 *  palette (independent of the surrounding app theme). */
export type PnlCardArtTheme = 'dark' | 'light'

/** Key into `CARD_ART` — one of the 48 bundled composites. */
export type CollectibleKey = `${PnlCardPlanet}-${PnlCardMascot}-${PnlCardArtTheme}`

/** The user's per-share art choice. Persisted in localStorage between shares. */
export interface PnlCardArtSelection {
  readonly planet: PnlCardPlanet
  readonly mascot: PnlCardMascot
  readonly theme: PnlCardArtTheme
}

/**
 * `full` — projected from a live (or just-closed) `PerpPositionSnapshot`: hero
 * ROE%, leverage badge, entry + mark rows, %↔$ toggle.
 * `degraded` — projected from a closed `Fill`: realized `$closedPnl` hero, no
 * leverage badge. Entry + realized PnL% (return on the closed notional) are
 * derived from the fill arithmetic when `closedPnl` is present — which keeps
 * the entry row and the %↔$ toggle; when it's absent the card falls back to a
 * $-only hero with no toggle and no entry. See ADR-0037.
 */
export type PnlCardMode = 'full' | 'degraded'

/** Which figure the hero shows; the toggle is hidden in `degraded` mode. */
export type PnlHeroDisplay = 'pct' | 'usd'

/**
 * The single normalized card model. Both a `PerpPositionSnapshot` (full) and a
 * `Fill` (degraded) project into this via the mappers in `pnl-card.utils.ts`,
 * so the presentational `PnlCard` is source-agnostic and venue-agnostic — it
 * never imports a domain or venue type, only this view.
 */
export interface PnlCardView {
  readonly side: PnlCardSide
  readonly mode: PnlCardMode
  /** Raw market symbol — identity + deep-link param (`xyz:NVDA`, `BTC-PERP`). */
  readonly symbol: string
  /** Cleaned asset name for display (`NVDA` for `xyz:NVDA`). */
  readonly displaySymbol: string
  /** `20x` for full cards; `null` for degraded (a `Fill` carries no leverage). */
  readonly leverageLabel: string | null
  /** Formatted PnL% (`+31.63%`) — ROE for full cards, realized return on the
   *  closed notional for degraded; `null` when not derivable. */
  readonly heroPctLabel: string | null
  /** Formatted signed USD PnL (`+$1,234.56`); always present. */
  readonly heroUsdLabel: string
  /** Sign of the PnL — tints the hero number + its neon glow. */
  readonly heroSign: PnlPctSign
  /** Formatted entry price (reconstructed from the fill arithmetic for
   *  degraded cards); `null` when not derivable. */
  readonly entryPriceLabel: string | null
  /** Formatted mark (full) or exit/fill (degraded) price. */
  readonly markPriceLabel: string | null
  /** Row label for `markPriceLabel`: `Mark` (full) | `Exit` (degraded). */
  readonly markRowLabel: string
  /** `Realized` badge for post-close + degraded cards; `null` for a live full card. */
  readonly realizedBadge: string | null
  /** App-relative deep link to the traded market (`/trade?market=hl:<symbol>`). */
  readonly deepLinkPath: string
  /** Sharer's `@handle`, stamped bottom-right (replaces the deep link). Sharing
   *  is only ever the user's own PnL, so this is normally present; `null` is a
   *  defensive fallback (no handle resolved) and renders nothing. */
  readonly handle: string | null
  /** Display label of the DEX the trade was on (`Hyperliquid`, `Extended`). */
  readonly venueLabel: string
  /** Bundled DEX logo for `venueLabel`; `null` when the venue has no logo. */
  readonly venueIconSrc: string | null
  /** The traded market — rendered via the shared `AssetIcon` (real coin icon
   *  with the same fallback ladder as the rest of the app). `null` when the
   *  market can't be resolved (markets not loaded) → letter placeholder. */
  readonly market: Market | null
}

/** Identity + venue context the mappers stamp onto a `PnlCardView`. */
export interface PnlCardContext {
  /** Sharer's handle (without the leading `@`). */
  readonly handle: string | null
  /** Venue id (`hyperliquid`, `extended`, …) — resolves the bundled DEX logo. */
  readonly venueId: string
  /** Venue display label (`Hyperliquid`). */
  readonly venueLabel: string
  /** The traded market for the real asset icon; `null` when unresolved. */
  readonly market: Market | null
}

export interface PnlCardProps {
  view: PnlCardView
  displayMode: PnlHeroDisplay
  /** The collectible art the card wears (planet × mascot × theme). Selects the
   *  background PNG and drives the ink palette via `data-theme`. */
  selection: PnlCardArtSelection
  /** The market icon inlined as a data URL for capture. When set, the card
   *  renders it (works in both the live preview and the exported PNG); `null`
   *  means no CORS-inlinable source was found (or none yet). See
   *  `usePnlCardCaptureIcon`. */
  iconDataUrl: string | null
  /** True while the inlined icon is still resolving — the card shows the live
   *  `AssetIcon` as a graceful placeholder until the data URL lands (or a
   *  letter once resolution settles with nothing inlinable). */
  isIconResolving: boolean
  /** Forwarded to the capture node so `modern-screenshot` reads it at 1080×680. */
  ref?: RefObject<HTMLDivElement | null>
}

export interface PnlSideArrowProps {
  side: PnlCardSide
}

export interface PnlCardActionsProps {
  isExporting: boolean
  /** Native OS share sheet with the PNG attached (Web Share API); the primary
   *  path to post the image to X/Telegram apps. Falls back where unsupported. */
  onShareNative: () => void
  onDownload: () => void
  onCopyImage: () => void
  onCopyLink: () => void
  onShareToX: () => void
  onShareToTelegram: () => void
}

export interface PnlCardModalProps {
  /** The card to show, or `null` when closed (mirrors `ClosePositionDialog`). */
  view: PnlCardView | null
  isMobile: boolean
  onClose: () => void
}

export interface PnlCardModalBodyProps {
  view: PnlCardView
  modal: UsePnlCardModalReturn
}

export interface UsePnlCardModalArgs {
  view: PnlCardView | null
}

/** Direction a stepper moves through its ordered option ring: next (`1`) /
 *  previous (`-1`). Both steppers wrap around the ends. */
export type StepDirection = 1 | -1

export interface UsePnlCardModalReturn {
  displayMode: PnlHeroDisplay
  setDisplayMode: (mode: PnlHeroDisplay) => void
  /** The live art choice (planet × mascot × theme). Seeded from persisted picks
   *  on first open (falling back to the default + app theme). */
  selection: PnlCardArtSelection
  /** The art the card is actually wearing — trails `selection` by one image
   *  decode so stepping never flashes a blank card while the PNG loads. The
   *  pickers/labels read `selection` (instant); the card reads this. */
  displayedSelection: PnlCardArtSelection
  /** Market icon inlined as a data URL for a capturable PNG; `null` when none
   *  is inlinable yet. Passed straight to the card. */
  iconDataUrl: string | null
  /** True while the inlined icon is resolving (drives the card's icon placeholder). */
  isIconResolving: boolean
  /** Advance/retreat the planet ring (wraps). */
  onStepPlanet: (dir: StepDirection) => void
  /** Advance/retreat the mascot ring (wraps). */
  onStepMascot: (dir: StepDirection) => void
  /** Set the art theme (Light/Dark segmented control). */
  onSetTheme: (theme: PnlCardArtTheme) => void
  /** Display label for the current planet (`Saturn`) — stepper caption. */
  planetLabel: string
  /** Display label for the current mascot (`Dino`) — stepper caption. */
  mascotLabel: string
  /** Whether the %↔$ toggle is offered (false in degraded mode). */
  canToggle: boolean
  /** Capture target — the natural-size 1080×680 card node. */
  cardRef: RefObject<HTMLDivElement | null>
  /** Callback ref for the preview viewport. Attaches a `ResizeObserver` on mount
   *  (and re-attaches on any remount — e.g. the Modal↔Sheet swap) to keep the
   *  preview scale in sync with the container width. */
  previewViewportRef: (node: HTMLDivElement | null) => void
  /** `viewportWidth / 1080` — applied as a transform to the preview card. */
  previewScale: number
  isExporting: boolean
  onShareNative: () => void
  onDownload: () => void
  onCopyImage: () => void
  onCopyLink: () => void
  onShareToX: () => void
  onShareToTelegram: () => void
}

/** Props for the `PnlCardPickers` control cluster (mascot/planet steppers,
 *  Light/Dark theme, %↔$ toggle). A dumb sub-component fed by the modal hook. */
export interface PnlCardPickersProps {
  selection: PnlCardArtSelection
  planetLabel: string
  mascotLabel: string
  displayMode: PnlHeroDisplay
  canToggle: boolean
  onStepPlanet: (dir: StepDirection) => void
  onStepMascot: (dir: StepDirection) => void
  onSetTheme: (theme: PnlCardArtTheme) => void
  setDisplayMode: (mode: PnlHeroDisplay) => void
}

/** Props for a single labeled arrow stepper (`◀ Saturn ▶`). */
export interface PnlCardStepperProps {
  label: string
  value: string
  ariaLabel: string
  onStep: (dir: StepDirection) => void
}

export interface UsePnlCardCaptureIconReturn {
  /** Market icon inlined as a data URL, or `null` when nothing inlinable was
   *  found (or resolution is still in flight — pair with `isIconResolving`). */
  iconDataUrl: string | null
  /** True while the fetch/inline walk is in flight for the current market. */
  isIconResolving: boolean
}

export interface UsePnlCardExportArgs {
  view: PnlCardView | null
  cardRef: RefObject<HTMLDivElement | null>
}

export interface UsePnlCardExportReturn {
  isExporting: boolean
  onShareNative: () => void
  onDownload: () => void
  onCopyImage: () => void
  onCopyLink: () => void
  onShareToX: () => void
  onShareToTelegram: () => void
}

/** The PNG raster failed (node missing, fonts, or `modern-screenshot` threw). */
export type PnlCardExportErrorKind = 'no-node' | 'raster' | 'clipboard'

export class PnlCardExportError extends Error {
  readonly kind: PnlCardExportErrorKind
  constructor(kind: PnlCardExportErrorKind, cause?: unknown) {
    super(`pnl-card export failed: ${kind}`)
    this.name = 'PnlCardExportError'
    this.kind = kind
    this.cause = cause
  }
}
