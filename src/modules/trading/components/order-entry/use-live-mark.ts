import { useCallback } from 'react'
import type { Ticker } from '../../../shared/domain/domain.types'
import { useCapabilityOptional } from '../../../shared/providers/venue-provider'
import { useAdapterStream } from '../../hooks/use-adapter-stream'

/**
 * Live mark price for `symbol`, sourced from the venue's ticker stream.
 *
 * Order entry's mark must tick: `market.markPrice` is written only by the
 * once-per-venue `marketData.refresh()`, so reading it directly freezes the MID
 * button and the limit-price reference at the session-open price (S8 / bug #2).
 * This hook subscribes to `subscribeTicker` (the same capability the header
 * ticker consumes — never a gateway `subscribe*`; see websocket-streaming.md §4)
 * and re-emits `ticker.markPrice` on every tick.
 *
 * `fallback` (the static `market.markPrice`) seeds the value until the first
 * tick lands, so the mark is never `0` while the stream is still connecting.
 * Resubscribes on symbol change and unsubscribes cleanly on unmount via
 * `useAdapterStream`'s lifecycle.
 *
 * S2 (live mark inside `previewOrder`) can reuse this hook unchanged.
 */
export function useLiveMark(symbol: string, fallback: number): number {
  // marketData is optional like every order-entry capability except `trader`: a
  // venue without it (or a test that omits it) falls back to the static
  // `fallback` mark — never throws. Hyperliquid supplies it, so the mark ticks.
  const marketDataCap = useCapabilityOptional('marketData')

  const subscribe = useCallback(
    (onMark: (mark: number) => void) => {
      if (symbol === '') return () => {}
      if (!marketDataCap) return () => {}
      return marketDataCap.subscribeTicker(symbol, (ticker: Ticker) => {
        onMark(ticker.markPrice)
      })
    },
    [marketDataCap, symbol],
  )

  return useAdapterStream<number, number>({
    initial: fallback,
    subscribe,
    reducer: reduceMark,
    resetOnSubscribe: true,
  })
}

function reduceMark(_previous: number, mark: number): number {
  return mark
}
