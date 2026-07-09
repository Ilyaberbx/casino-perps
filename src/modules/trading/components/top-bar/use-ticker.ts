import { useCallback } from 'react'
import type { Ticker } from '../../../shared/domain/domain.types'
import { useCapability } from '../../../shared/providers/venue-provider'
import { useAdapterStream } from '../../hooks/use-adapter-stream'

function reduceTicker(_previous: Ticker | null, ticker: Ticker): Ticker {
  return ticker
}

export function useTicker(symbol: string): Ticker | null {
  const marketDataCap = useCapability('marketData')

  const subscribe = useCallback(
    (onEvent: (ticker: Ticker) => void) => {
      // Bug A: skip subscribe when symbol unresolved. See use-orderbook.ts.
      if (symbol === '') return () => {}
      return marketDataCap.subscribeTicker(symbol, onEvent)
    },
    [marketDataCap, symbol],
  )

  return useAdapterStream<Ticker, Ticker | null>({
    initial: null,
    subscribe,
    reducer: reduceTicker,
    resetOnSubscribe: true,
  })
}
