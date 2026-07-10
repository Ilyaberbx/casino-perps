import { useCallback, useEffect, useState } from 'react'
import { useCapability, useOwnCapability } from '@/modules/shared/providers/venue-provider'
import { toast } from '@/modules/shared/services/toast'
import { generateCloid } from '@/modules/shared/utils/generate-cloid'
import type {
  Market,
  PerpPositionSnapshot,
  PlaceOrderRequest,
} from '@/modules/shared/domain'
import { ORDER_CLOID_PREFIX } from '../components/order-entry/order-entry.constants'
import { formatLiquidationSentence, positionSideToDirection } from './casino-trade.utils'
import type { BetDirection } from './casino-trade.types'

/** The single open bet on the current market, projected for the live-bet row. */
export interface LiveBetView {
  readonly direction: BetDirection
  readonly leverage: number
  readonly profitUsd: number
  readonly isWinning: boolean
  readonly liquidationSentence: string
}

export interface UseLiveBetReturn {
  readonly liveBet: LiveBetView | null
  readonly isCashingOut: boolean
  cashOut(): void
}

/** Reduce-only market close of the full position — the opposite side, full size. */
function buildFullCloseRequest(position: PerpPositionSnapshot): PlaceOrderRequest {
  return {
    orderType: 'market',
    symbol: position.symbol,
    side: position.side === 'long' ? 'sell' : 'buy',
    size: position.size,
    reduceOnly: true,
    clientOrderId: generateCloid(ORDER_CLOID_PREFIX),
  }
}

/**
 * The live-bet surface for the current market. Subscribes to the User's own
 * perps-positions snapshot (Acting-Address-keyed, so it shows self even while
 * Spectating) and, when a position on this market is open, exposes its
 * direction / multiplier / profit / liquidation prose plus a Cash Out that
 * market-closes the FULL position via the `Trader` port.
 */
export function useLiveBet(market: Market): UseLiveBetReturn {
  const trader = useCapability('trader')
  const positionsCap = useOwnCapability('perpsPositionsSnapshot')
  const [position, setPosition] = useState<PerpPositionSnapshot | null>(null)
  const [isCashingOut, setIsCashingOut] = useState(false)

  const symbol = market.symbol

  useEffect(() => {
    if (!positionsCap) return
    return positionsCap.subscribe((positions) => {
      const match = positions.find((entry) => entry.symbol === symbol)
      setPosition(match ?? null)
    })
  }, [positionsCap, symbol])

  const cashOut = useCallback(() => {
    if (!position) return
    if (isCashingOut) return
    setIsCashingOut(true)
    trader.placeOrder(buildFullCloseRequest(position)).match(
      () => {
        setIsCashingOut(false)
        toast.show({ variant: 'success', title: 'Cashed out', description: market.baseAsset })
      },
      (error) => {
        setIsCashingOut(false)
        toast.show({ variant: 'error', title: 'Cash out failed', description: error.message })
      },
    )
  }, [position, isCashingOut, trader, market.baseAsset])

  const liveBet = position === null ? null : projectLiveBet(position, market)
  return { liveBet, isCashingOut, cashOut }
}

function projectLiveBet(position: PerpPositionSnapshot, market: Market): LiveBetView {
  const direction = positionSideToDirection(position.side)
  return {
    direction,
    leverage: position.leverage,
    profitUsd: position.unrealizedPnlUsd,
    isWinning: position.unrealizedPnlUsd >= 0,
    liquidationSentence: formatLiquidationSentence(
      direction,
      position.liquidationPrice ?? 0,
      market,
    ),
  }
}
