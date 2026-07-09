import { describe, it, expect } from 'vitest'
import type { Order, OpenOrdersSnapshotReader, Unsubscribe } from '@/modules/shared/domain'
import type { HyperliquidAssetInfo } from '../hyperliquid-trader.types'
import { createHyperliquidOrderRefResolver } from '../hyperliquid-order-ref-resolver'

const BTC_ASSET: HyperliquidAssetInfo = { assetId: 0, szDecimals: 5, marketType: 'perp' }

const SAMPLE_ORDER: Order = {
  identifier: '12345',
  symbol: 'BTC',
  side: 'buy',
  size: 1.0,
  price: 95_000,
  filledSize: 0,
  status: 'open',
  orderType: 'limit',
  timestamp: 1_700_000_000_000,
  originalSize: 1.0,
  reduceOnly: false,
}

function fakeOpenOrders(): {
  reader: OpenOrdersSnapshotReader
  emit: (orders: ReadonlyArray<Order>) => void
  unsubscribed: () => boolean
} {
  let onUpdate: ((orders: ReadonlyArray<Order>) => void) | null = null
  let wasUnsubscribed = false
  return {
    reader: {
      subscribe(cb): Unsubscribe {
        onUpdate = cb
        return () => {
          wasUnsubscribed = true
        }
      },
    },
    emit(orders) {
      onUpdate?.(orders)
    },
    unsubscribed: () => wasUnsubscribed,
  }
}

describe('createHyperliquidOrderRefResolver', () => {
  it('resolves a cached resting order into a full order ref with the asset id', () => {
    const fake = fakeOpenOrders()
    const resolver = createHyperliquidOrderRefResolver({
      openOrders: fake.reader,
      resolveAssetInfo: () => BTC_ASSET,
    })
    fake.emit([SAMPLE_ORDER])
    const ref = resolver.resolve('12345')
    expect(ref).toEqual({
      assetId: 0,
      oid: 12345,
      symbol: 'BTC',
      side: 'buy',
      price: 95_000,
      size: 1.0,
      reduceOnly: false,
    })
  })

  it('returns null when the identifier is not in the latest snapshot', () => {
    const fake = fakeOpenOrders()
    const resolver = createHyperliquidOrderRefResolver({
      openOrders: fake.reader,
      resolveAssetInfo: () => BTC_ASSET,
    })
    fake.emit([SAMPLE_ORDER])
    expect(resolver.resolve('99999')).toBeNull()
  })

  it('returns null when the order symbol has no resolvable asset metadata', () => {
    const fake = fakeOpenOrders()
    const resolver = createHyperliquidOrderRefResolver({
      openOrders: fake.reader,
      resolveAssetInfo: () => null,
    })
    fake.emit([SAMPLE_ORDER])
    expect(resolver.resolve('12345')).toBeNull()
  })

  it('reflects the latest snapshot after a re-emit (order no longer resting → null)', () => {
    const fake = fakeOpenOrders()
    const resolver = createHyperliquidOrderRefResolver({
      openOrders: fake.reader,
      resolveAssetInfo: () => BTC_ASSET,
    })
    fake.emit([SAMPLE_ORDER])
    expect(resolver.resolve('12345')).not.toBeNull()
    fake.emit([])
    expect(resolver.resolve('12345')).toBeNull()
  })

  it('stop() tears down the snapshot subscription', () => {
    const fake = fakeOpenOrders()
    const resolver = createHyperliquidOrderRefResolver({
      openOrders: fake.reader,
      resolveAssetInfo: () => BTC_ASSET,
    })
    resolver.stop()
    expect(fake.unsubscribed()).toBe(true)
  })
})
