import { useEffect, useState } from 'react'
import { ResultAsync, errAsync } from 'neverthrow'
import type { Market } from '@/modules/shared/domain'
import { cardIconCandidates } from './pnl-card.utils'
import type { PnlCardView, UsePnlCardCaptureIconReturn } from './pnl-card.types'

/**
 * Inline the traded market's icon into a data URL so it survives into the
 * exported PNG. `modern-screenshot` can only bake an image whose bytes it can
 * read: a cross-origin `<img>` renders fine on screen, but rasterization needs
 * the pixels, and only TradingView's CDN sends CORS (Hyperliquid's does not).
 *
 * The hook walks `cardIconCandidates` (CORS-capable first) and keeps the first
 * URL that yields readable bytes, exposing it as `iconDataUrl`. A market with no
 * inlinable source resolves to `null` → the card renders the letter placeholder
 * (which captures cleanly) instead of a blank box. All best-effort: failures are
 * swallowed (errors as values), never surfaced — a missing icon is not a share
 * failure. jsdom / no-`fetch` environments no-op.
 */
export function usePnlCardCaptureIcon(view: PnlCardView | null): UsePnlCardCaptureIconReturn {
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(null)
  const [isIconResolving, setIsIconResolving] = useState(false)
  const market: Market | null = view?.market ?? null

  useEffect(() => {
    let cancelled = false
    const canResolve = market !== null && typeof fetch === 'function'
    const candidates = canResolve ? cardIconCandidates(market) : []

    // Helpers live in-closure: they do IO, so they can't be module-scope utils.
    const blobToDataUrl = (blob: Blob): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })

    const inlineOne = (url: string): ResultAsync<string, unknown> =>
      ResultAsync.fromPromise(fetch(url), (cause) => cause)
        .andThen((response) =>
          response.ok
            ? ResultAsync.fromPromise(response.blob(), (cause) => cause)
            : errAsync<Blob, unknown>(new Error(`icon fetch ${response.status}`)),
        )
        .andThen((blob) => ResultAsync.fromPromise(blobToDataUrl(blob), (cause) => cause))

    // All state updates happen inside this async function (never synchronously
    // in the effect body — that triggers cascading renders). The first success
    // wins; failing candidates (HL's no-CORS URLs) fall through to the next.
    const resolveIcon = async () => {
      if (candidates.length === 0) {
        if (cancelled) return
        setIconDataUrl(null)
        setIsIconResolving(false)
        return
      }
      setIsIconResolving(true)
      const firstInlinable = candidates.reduce<ResultAsync<string, unknown>>(
        (acc, url) => acc.orElse(() => inlineOne(url)),
        errAsync<string, unknown>(new Error('no candidate')),
      )
      const outcome = await firstInlinable
      if (cancelled) return
      setIconDataUrl(outcome.isOk() ? outcome.value : null)
      setIsIconResolving(false)
    }
    void resolveIcon()

    return () => {
      cancelled = true
    }
  }, [market])

  return { iconDataUrl, isIconResolving }
}
