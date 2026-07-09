import type { Order, OpenOrdersSnapshotReader } from '@/modules/shared/domain'
import type { HyperliquidAssetInfo, HyperliquidOrderRef } from './hyperliquid-trader.types'

/**
 * Resolves a domain `OrderIdentifier` (the `oid` string the open-orders
 * snapshot reader emits) to the `HyperliquidOrderRef` the trader needs to
 * cancel / modify a resting order. Reuses the existing live open-orders
 * snapshot reader (no new stream): it subscribes once and caches the latest
 * `Order[]`, then resolves the asset id from the market-data asset-info index.
 *
 * `null` ⇒ the order is no longer resting (already filled / cancelled), unknown
 * to the cache, or its symbol's asset metadata is not yet resolved — the trader
 * maps that to a typed `not-found` error.
 */
export interface HyperliquidOrderRefResolver {
  resolve(identifier: string): HyperliquidOrderRef | null
  /** Tear down the snapshot subscription. */
  stop(): void
}

export interface CreateHyperliquidOrderRefResolverDeps {
  readonly openOrders: OpenOrdersSnapshotReader
  readonly resolveAssetInfo: (symbol: string) => HyperliquidAssetInfo | null
}

export function createHyperliquidOrderRefResolver(
  deps: CreateHyperliquidOrderRefResolverDeps,
): HyperliquidOrderRefResolver {
  let latest: ReadonlyArray<Order> = []
  const unsubscribe = deps.openOrders.subscribe((orders) => {
    latest = orders
  })

  function resolve(identifier: string): HyperliquidOrderRef | null {
    const order = latest.find((candidate) => candidate.identifier === identifier)
    if (order === undefined) return null
    const asset = deps.resolveAssetInfo(order.symbol)
    if (asset === null) return null
    const oid = Number(order.identifier)
    if (!Number.isInteger(oid)) return null
    return {
      assetId: asset.assetId,
      oid,
      symbol: order.symbol,
      side: order.side,
      price: order.price,
      size: order.originalSize ?? order.size,
      reduceOnly: order.reduceOnly ?? false,
    }
  }

  return {
    resolve,
    stop: unsubscribe,
  }
}
