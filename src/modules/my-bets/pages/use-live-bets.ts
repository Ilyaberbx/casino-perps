import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useCapability,
  useCapabilityOptional,
  useOwnCapability,
} from '@/modules/shared/providers/venue-provider'
import { toast } from '@/modules/shared/services/toast'
import type { Market, PerpPositionSnapshot } from '@/modules/shared/domain'
import { buildFullCloseRequest, projectLiveBet } from '../my-bets.utils'
import type { LiveBet } from '../my-bets.types'

/**
 * The LIVE BETS surface: every open bet across all markets, plus a Cash Out that
 * market-closes the full position through the `Trader` port — the same
 * reduce-only market-close the trade screen uses. Positions come from the
 * Acting-Address-keyed snapshot reader (shows self even while Spectating);
 * markets (optional) supply each bet's display ticker + liquidation-price
 * precision for the D16 prose.
 */
export function useLiveBets(): {
  liveBets: ReadonlyArray<LiveBet>
  onCashOut(symbol: string): void
} {
  const trader = useCapability('trader')
  const positionsCap = useOwnCapability('perpsPositionsSnapshot')
  const marketData = useCapabilityOptional('marketData')
  const [positions, setPositions] = useState<ReadonlyArray<PerpPositionSnapshot>>([])
  const [markets, setMarkets] = useState<ReadonlyArray<Market>>([])
  const [cashingOut, setCashingOut] = useState<ReadonlySet<string>>(() => new Set())

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

  const onCashOut = useCallback(
    (symbol: string) => {
      const position = positions.find((entry) => entry.symbol === symbol)
      if (!position) return
      if (cashingOut.has(symbol)) return
      setCashingOut((previous) => new Set(previous).add(symbol))
      trader.placeOrder(buildFullCloseRequest(position)).match(
        () => {
          setCashingOut((previous) => removeFrom(previous, symbol))
          toast.show({ variant: 'success', title: 'Cashed out', description: position.symbol })
        },
        (error) => {
          setCashingOut((previous) => removeFrom(previous, symbol))
          toast.show({ variant: 'error', title: 'Cash out failed', description: error.message })
        },
      )
    },
    [positions, cashingOut, trader],
  )

  const liveBets = useMemo(
    () =>
      positions.map((position) =>
        projectLiveBet(position, marketsBySymbol.get(position.symbol), cashingOut.has(position.symbol)),
      ),
    [positions, marketsBySymbol, cashingOut],
  )

  return { liveBets, onCashOut }
}

function removeFrom(set: ReadonlySet<string>, symbol: string): ReadonlySet<string> {
  const next = new Set(set)
  next.delete(symbol)
  return next
}
