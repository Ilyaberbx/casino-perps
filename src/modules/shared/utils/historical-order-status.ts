import type { HistoricalOrderStatus } from '@/modules/shared/domain'

/**
 * Human-readable label for every `HistoricalOrderStatus` literal. The default
 * branch narrows to `never`: if the SDK adds a new literal and our domain
 * union widens to include it, the unmatched case fails typecheck instead of
 * silently rendering "unknown" — see `hyperliquid/services/order-history-reader.ts`
 * for the SDK↔domain equivalence guard.
 *
 * Shared by the Portfolio Order History tab and the trading Account Dock's
 * Order History panel (promoted from `portfolio/` per the ≥2-module rule).
 */
export function historicalOrderStatusLabel(status: HistoricalOrderStatus): string {
  switch (status) {
    case 'open':
      return 'Open'
    case 'filled':
      return 'Filled'
    case 'canceled':
      return 'Canceled'
    case 'triggered':
      return 'Triggered'
    case 'rejected':
      return 'Rejected'
    case 'marginCanceled':
      return 'Canceled (margin)'
    case 'vaultWithdrawalCanceled':
      return 'Canceled (vault withdrawal)'
    case 'openInterestCapCanceled':
      return 'Canceled (OI cap)'
    case 'selfTradeCanceled':
      return 'Canceled (self-trade)'
    case 'reduceOnlyCanceled':
      return 'Canceled (reduce-only)'
    case 'siblingFilledCanceled':
      return 'Canceled (sibling filled)'
    case 'delistedCanceled':
      return 'Canceled (delisted)'
    case 'liquidatedCanceled':
      return 'Canceled (liquidated)'
    case 'scheduledCancel':
      return 'Canceled (scheduled)'
    case 'tickRejected':
      return 'Rejected (tick)'
    case 'minTradeNtlRejected':
      return 'Rejected (min notional)'
    case 'perpMarginRejected':
      return 'Rejected (margin)'
    case 'reduceOnlyRejected':
      return 'Rejected (reduce-only)'
    case 'badAloPxRejected':
      return 'Rejected (post-only)'
    case 'iocCancelRejected':
      return 'Rejected (IOC)'
    case 'badTriggerPxRejected':
      return 'Rejected (trigger price)'
    case 'marketOrderNoLiquidityRejected':
      return 'Rejected (no liquidity)'
    case 'positionIncreaseAtOpenInterestCapRejected':
      return 'Rejected (OI cap, increase)'
    case 'positionFlipAtOpenInterestCapRejected':
      return 'Rejected (OI cap, flip)'
    case 'tooAggressiveAtOpenInterestCapRejected':
      return 'Rejected (OI cap, aggressive)'
    case 'openInterestIncreaseRejected':
      return 'Rejected (OI increase)'
    case 'insufficientSpotBalanceRejected':
      return 'Rejected (spot balance)'
    case 'oracleRejected':
      return 'Rejected (oracle)'
    case 'perpMaxPositionRejected':
      return 'Rejected (max position)'
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}
