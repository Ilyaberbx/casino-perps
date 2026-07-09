import { useCallback, useState } from 'react'
import { ResultAsync, errAsync } from 'neverthrow'
import { toast } from '@/modules/shared/services/toast'
import { EXPORT_HEIGHT, EXPORT_SCALE, EXPORT_WIDTH } from './pnl-card.constants'
import {
  buildShareLink,
  buildTelegramShareUrl,
  buildXIntentText,
  buildXIntentUrl,
  exportFileName,
} from './pnl-card.utils'
import { PnlCardExportError } from './pnl-card.types'
import type { UsePnlCardExportArgs, UsePnlCardExportReturn } from './pnl-card.types'

/**
 * Owns the four client-only share actions for the PnL card. Rasterizes the
 * off-screen card node (natural 1080×680, captured at EXPORT_SCALE=2 → a
 * 2160×1360 PNG, pixel-exact with the collectible art) to a PNG via
 * `modern-screenshot` — dimensions come from the EXPORT_* constants, never
 * hardcoded here. Captures after fonts are ready so the display accent face
 * embeds, then downloads / copies / shares. Errors are values (`neverthrow`)
 * surfaced as toasts — no `try/catch`.
 */
export function usePnlCardExport({ view, cardRef }: UsePnlCardExportArgs): UsePnlCardExportReturn {
  const [isExporting, setIsExporting] = useState(false)

  const capture = useCallback((): ResultAsync<Blob, PnlCardExportError> => {
    const node = cardRef.current
    if (node === null) return errAsync(new PnlCardExportError('no-node'))
    // Lazy-load the modern-screenshot rasterizer (ADR-0037) only when a capture
    // actually fires — it's only needed on an explicit share/download, never at
    // startup, so a dynamic import keeps it out of the initial bundle. The chunk
    // load overlaps with the display-accent-font wait below.
    //
    // Wait for the display accent font before snapshotting — a capture fired
    // before it loads bakes a fallback face into the PNG (ADR-0037 D-5).
    const blob = Promise.all([import('modern-screenshot'), document.fonts.ready]).then(
      ([{ domToBlob }]) =>
        domToBlob(node, { width: EXPORT_WIDTH, height: EXPORT_HEIGHT, scale: EXPORT_SCALE }),
    )
    return ResultAsync.fromPromise(blob, (cause) => new PnlCardExportError('raster', cause))
  }, [cardRef])

  const downloadBlob = useCallback(
    (blob: Blob) => {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = view !== null ? exportFileName(view) : 'pnl.png'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    },
    [view],
  )

  const onDownload = useCallback(() => {
    if (view === null) return
    setIsExporting(true)
    void capture().match(
      (blob) => {
        downloadBlob(blob)
        setIsExporting(false)
      },
      () => {
        toast.show({ variant: 'error', title: 'Could not render card' })
        setIsExporting(false)
      },
    )
  }, [view, capture, downloadBlob])

  const onCopyImage = useCallback(() => {
    if (view === null) return
    const canWriteClipboardImage =
      typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function'
    setIsExporting(true)
    void capture().match(
      (blob) => {
        if (!canWriteClipboardImage) {
          downloadBlob(blob)
          toast.show({ variant: 'info', title: 'Image copy unsupported — downloaded instead' })
          setIsExporting(false)
          return
        }
        const written = ResultAsync.fromPromise(
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]),
          (cause) => new PnlCardExportError('clipboard', cause),
        )
        void written.match(
          () => {
            toast.show({ variant: 'success', title: 'Copied image' })
            setIsExporting(false)
          },
          () => {
            downloadBlob(blob)
            toast.show({ variant: 'info', title: 'Image copy failed — downloaded instead' })
            setIsExporting(false)
          },
        )
      },
      () => {
        toast.show({ variant: 'error', title: 'Could not render card' })
        setIsExporting(false)
      },
    )
  }, [view, capture, downloadBlob])

  const onCopyLink = useCallback(() => {
    if (view === null) return
    const link = buildShareLink(view, window.location.origin)
    const written = ResultAsync.fromPromise(
      navigator.clipboard.writeText(link),
      (cause) => new PnlCardExportError('clipboard', cause),
    )
    void written.match(
      () => toast.show({ variant: 'success', title: 'Link copied' }),
      () => toast.show({ variant: 'error', title: 'Could not copy link' }),
    )
  }, [view])

  const onShareToX = useCallback(() => {
    if (view === null) return
    // The tweet intent can't carry an image — open the composer with prefilled
    // text + the market link, and download the PNG for the user to attach.
    window.open(buildXIntentUrl(view, window.location.origin), '_blank', 'noopener')
    onDownload()
  }, [view, onDownload])

  const onShareToTelegram = useCallback(() => {
    if (view === null) return
    // Telegram's share URL is text + link only — same manual-attach pattern as X.
    window.open(buildTelegramShareUrl(view, window.location.origin), '_blank', 'noopener')
    onDownload()
  }, [view, onDownload])

  const onShareNative = useCallback(() => {
    if (view === null) return
    // The only way to post the image *natively* (attached, not just linked): the
    // Web Share API with files. It opens the OS share sheet so the user picks the
    // X/Telegram app and the PNG rides along. Where files aren't shareable (most
    // desktop browsers) fall back to the X composer + auto-downloaded PNG.
    setIsExporting(true)
    void capture().match(
      (blob) => {
        const file = new File([blob], view !== null ? exportFileName(view) : 'pnl.png', {
          type: 'image/png',
        })
        const shareData = {
          files: [file],
          text: buildXIntentText(view),
          url: buildShareLink(view, window.location.origin),
        }
        const canShareFiles =
          typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
        if (!canShareFiles) {
          setIsExporting(false)
          onShareToX()
          return
        }
        const shared = ResultAsync.fromPromise(
          navigator.share(shareData),
          (cause) => new PnlCardExportError('clipboard', cause),
        )
        void shared.match(
          () => setIsExporting(false),
          (error) => {
            setIsExporting(false)
            // A user dismissing the share sheet rejects with AbortError — that's
            // not a failure, stay silent. Any other error falls back to the X path.
            const cause = error.cause
            const isAbort = cause instanceof DOMException && cause.name === 'AbortError'
            if (isAbort) return
            onShareToX()
          },
        )
      },
      () => {
        toast.show({ variant: 'error', title: 'Could not render card' })
        setIsExporting(false)
      },
    )
  }, [view, capture, onShareToX])

  return {
    isExporting,
    onShareNative,
    onDownload,
    onCopyImage,
    onCopyLink,
    onShareToX,
    onShareToTelegram,
  }
}
