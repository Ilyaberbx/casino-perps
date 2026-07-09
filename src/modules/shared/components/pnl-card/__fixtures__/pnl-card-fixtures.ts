import type { Fill, PerpPositionSnapshot } from '@/modules/shared/domain'

export function fakePositionSnapshot(
  overrides: Partial<PerpPositionSnapshot> = {},
): PerpPositionSnapshot {
  return {
    symbol: 'BTC-PERP',
    side: 'long',
    size: 0.5,
    entryPrice: 64210,
    markPrice: 71880,
    positionValueUsd: 35940,
    unrealizedPnlUsd: 3835,
    roePct: 31.63,
    leverage: 20,
    leverageType: 'cross',
    liquidationPrice: 41000,
    marginUsedUsd: 1797,
    ...overrides,
  }
}

export function fakeClosedFill(overrides: Partial<Fill> = {}): Fill {
  return {
    identifier: 'fill-1',
    orderIdentifier: 'order-1',
    symbol: 'ETH-PERP',
    side: 'sell',
    price: 3120.5,
    size: 2,
    fee: 1.2,
    timestamp: 1_717_000_000_000,
    closedPnl: 412.8,
    direction: 'Close Long',
    ...overrides,
  }
}
