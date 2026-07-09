import { okAsync, type ResultAsync } from 'neverthrow'
import type {
  HistoricalOrder,
  HistoricalOrderStatus,
  HistoricalOrderTif,
  HistoricalOrderType,
  OrderHistoryReader,
  PortfolioHistoryFetchError,
  Unsubscribe,
  WalletAddress,
} from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { HyperliquidGateway } from '../gateway/hyperliquid-gateway.types'
import type {
  HistoricalOrdersResponse,
  OrderProcessingStatusSchema,
} from '../gateway/sdk-types'
import { parseStringifiedNumber } from '../hyperliquid.utils'
import { mapGatewayHistoryError } from './map-gateway-history-error'

/**
 * Static-only assertion: our domain `HistoricalOrderStatus` and the SDK's
 * `OrderProcessingStatusSchema` must be the same set of literals. If the SDK
 * adds, removes, or renames a literal, one of these two assignments stops
 * type-checking and the build breaks before any "unknown" status can render.
 */
type _SdkAssignsToDomain = OrderProcessingStatusSchema extends HistoricalOrderStatus
  ? true
  : never
type _DomainAssignsToSdk = HistoricalOrderStatus extends OrderProcessingStatusSchema
  ? true
  : never
const _SDK_TO_DOMAIN_OK: _SdkAssignsToDomain = true
const _DOMAIN_TO_SDK_OK: _DomainAssignsToSdk = true
void _SDK_TO_DOMAIN_OK
void _DOMAIN_TO_SDK_OK

export function createHyperliquidOrderHistoryReader(
  gateway: HyperliquidGateway,
  getAddress: () => WalletAddress | null,
  logger: Logger,
): OrderHistoryReader {
  const log = logger.child({ module: 'hyperliquid-order-history-reader' })
  log.debug({}, 'init')

  const listeners = new Set<(orders: ReadonlyArray<HistoricalOrder>) => void>()
  let orders: ReadonlyArray<HistoricalOrder> = []
  let scopedAddress: WalletAddress | null = null
  let fetched = false

  function notify(): void {
    for (const l of listeners) l(orders)
  }

  function rescope(nextAddress: WalletAddress | null): void {
    if (nextAddress === scopedAddress) return
    scopedAddress = nextAddress
    fetched = false
    if (orders.length > 0) {
      orders = []
      notify()
    }
  }

  return {
    subscribe(onUpdate): Unsubscribe {
      listeners.add(onUpdate)
      onUpdate(orders)
      return () => {
        listeners.delete(onUpdate)
      }
    },
    loadOlder(): ResultAsync<{ exhausted: boolean }, PortfolioHistoryFetchError> {
      const address = getAddress()
      rescope(address)
      if (address === null) {
        return okAsync({ exhausted: true })
      }
      if (fetched) {
        return okAsync({ exhausted: true })
      }
      fetched = true
      const requestedAddress = address
      return gateway
        .getHistoricalOrders(address)
        .map((response) => {
          if (
            getAddress() !== requestedAddress ||
            scopedAddress !== requestedAddress
          ) {
            return { exhausted: true }
          }
          const projected = projectHistoricalOrders(response)
          orders = collapseToLatestStatus(projected)
          log.debug({ count: orders.length }, 'projection')
          notify()
          return { exhausted: true }
        })
        .mapErr((gatewayError) => {
          const mapped = mapGatewayHistoryError(gatewayError)
          log.warn(
            { kind: mapped.kind, errorMessage: gatewayError.message },
            'order history fetch failed',
          )
          return mapped
        })
    },
  }
}

/**
 * HL's `historicalOrders` returns the same `oid` more than once (one record per
 * status transition). The Order History table shows one row per order, so
 * collapse duplicates keeping the record with the newest `statusTimestamp` — the
 * order's current status — regardless of the response's ordering. First-seen
 * position is preserved (Map keeps a key's original slot on re-set).
 */
export function collapseToLatestStatus(
  orders: ReadonlyArray<HistoricalOrder>,
): HistoricalOrder[] {
  const byId = new Map<string, HistoricalOrder>()
  for (const order of orders) {
    const existing = byId.get(order.identifier)
    if (existing === undefined) {
      byId.set(order.identifier, order)
      continue
    }
    const isNewerStatus = order.statusTimestamp > existing.statusTimestamp
    if (isNewerStatus) byId.set(order.identifier, order)
  }
  return [...byId.values()]
}

export function projectHistoricalOrders(
  response: HistoricalOrdersResponse,
): ReadonlyArray<HistoricalOrder> {
  const out: HistoricalOrder[] = []
  for (const record of response) {
    const order = record.order
    out.push({
      identifier: String(order.oid),
      symbol: order.coin,
      side: order.side === 'B' ? 'buy' : 'sell',
      price: parseStringifiedNumber(order.limitPx),
      size: parseStringifiedNumber(order.sz),
      originalSize: parseStringifiedNumber(order.origSz),
      orderType: order.orderType as HistoricalOrderType,
      timeInForce: order.tif as HistoricalOrderTif,
      reduceOnly: order.reduceOnly,
      isTrigger: order.isTrigger,
      triggerPrice: parseStringifiedNumber(order.triggerPx),
      status: record.status,
      createdAt: order.timestamp,
      statusTimestamp: record.statusTimestamp,
    })
  }
  return out
}
