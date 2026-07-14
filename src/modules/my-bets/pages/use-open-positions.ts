import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useCapability,
  useCapabilityOptional,
  useOwnCapability,
} from '@/modules/shared/providers/venue-provider'
import { toast } from '@/modules/shared/services/toast'
import type { Market, PerpPositionSnapshot } from '@/modules/shared/domain'
import { buildFullCloseRequest, projectOpenPosition } from '../my-bets.utils'
import type { OpenPositionRow } from '../my-bets.types'

/**
 * Every open position across all markets, plus a Close that market-closes the
 * full position through the `Trader` port — the same reduce-only market-close
 * the trade screen uses. Positions come from the Acting-Address-keyed snapshot
 * reader (shows self even while Spectating); markets (optional) supply each
 * row's display ticker + liquidation-price precision.
 */
export function useOpenPositions(): {
  openPositions: ReadonlyArray<OpenPositionRow>
  onClose(symbol: string): void
} {
  const trader = useCapability('trader')
  const positionsCap = useOwnCapability('perpsPositionsSnapshot')
  const marketData = useCapabilityOptional('marketData')
  const [positions, setPositions] = useState<ReadonlyArray<PerpPositionSnapshot>>([])
  const [markets, setMarkets] = useState<ReadonlyArray<Market>>([])
  const [closing, setClosing] = useState<ReadonlySet<string>>(() => new Set())

  useEffect(() => {
    if (!positionsCap) return
    return positionsCap.subscribe((next) => setPositions(next))
  }, [positionsCap])

  useEffect(() => {
    if (!marketData) return
    return marketData.subscribeMarkets((next) => setMarkets(next))
  }, [marketData])

  const marketsBySymbol = useMemo(() => {
    const map = new Map<string, Market>()
    for (const market of markets) map.set(market.symbol, market)
    return map
  }, [markets])

  const onClose = useCallback(
    (symbol: string) => {
      const position = positions.find((entry) => entry.symbol === symbol)
      if (!position) return
      if (closing.has(symbol)) return
      setClosing((previous) => new Set(previous).add(symbol))
      trader.placeOrder(buildFullCloseRequest(position)).match(
        () => {
          setClosing((previous) => removeFrom(previous, symbol))
          toast.show({ variant: 'success', title: 'Position closed', description: position.symbol })
        },
        (error) => {
          setClosing((previous) => removeFrom(previous, symbol))
          toast.show({ variant: 'error', title: 'Close failed', description: error.message })
        },
      )
    },
    [positions, closing, trader],
  )

  const openPositions = useMemo(
    () =>
      positions.map((position) =>
        projectOpenPosition(
          position,
          marketsBySymbol.get(position.symbol),
          closing.has(position.symbol),
        ),
      ),
    [positions, marketsBySymbol, closing],
  )

  return { openPositions, onClose }
}

function removeFrom(set: ReadonlySet<string>, symbol: string): ReadonlySet<string> {
  const next = new Set(set)
  next.delete(symbol)
  return next
}
