import { okAsync } from 'neverthrow'
import type {
  Fill,
  Market,
  PerpPositionSnapshot,
  Trader,
  Venue,
} from '@/modules/shared/domain'

const noop = () => {}

/**
 * A minimal `Venue` for My Bets hook tests: a `Trader` spy plus an
 * Acting-Address-keyed `perpsPositionsSnapshot`, an optional `marketData`
 * stream, and an optional `fills` stream. Slots the hooks do not need are filled
 * with inert fakes so the `ownAccount` group shape stays complete.
 */
export function makeMyBetsVenue(options: {
  placeOrder: Trader['placeOrder']
  positions?: ReadonlyArray<PerpPositionSnapshot>
  markets?: ReadonlyArray<Market>
  fills?: ReadonlyArray<Fill>
}): Venue {
  const positions = options.positions ?? []
  const markets = options.markets ?? []
  const fills = options.fills ?? []
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => noop },
      trader: {
        placeOrder: options.placeOrder,
        cancelOrder: () => okAsync(undefined),
        validateDraft: () => {
          throw new Error('validateDraft not used in My Bets tests')
        },
        previewOrder: () => {
          throw new Error('previewOrder not used in My Bets tests')
        },
      },
      marketData: {
        refresh: async () => {},
        listMarkets: () => [...markets],
        subscribeMarkets: (onChange) => {
          onChange([...markets])
          return noop
        },
        subscribeOrderbook: () => noop,
        subscribeTrades: () => noop,
        subscribeTicker: () => noop,
      },
      fills: {
        subscribe: (onFill) => {
          for (const fill of fills) onFill(fill)
          return noop
        },
      },
      ownAccount: {
        portfolio: { subscribeSnapshot: () => noop, getHistory: () => okAsync([]) },
        balances: { subscribe: () => noop },
        perpsPositionsSnapshot: {
          subscribe: (onUpdate) => {
            onUpdate([...positions])
            return noop
          },
        },
        feeSchedule: { subscribe: () => noop },
        accountMode: { current: () => ({ isSegregated: true }), subscribe: () => noop },
      },
    },
  }
}

export function makePosition(overrides: Partial<PerpPositionSnapshot> = {}): PerpPositionSnapshot {
  return {
    symbol: 'BTC-PERP',
    side: 'long',
    size: 0.5,
    entryPrice: 100_000,
    markPrice: 104_000,
    positionValueUsd: 52_000,
    unrealizedPnlUsd: 124,
    roePct: 24.8,
    leverage: 10,
    leverageType: 'isolated',
    liquidationPrice: 94_102,
    marginUsedUsd: 500,
    ...overrides,
  }
}

export function makeMarket(overrides: Partial<Market> = {}): Market {
  return {
    symbol: 'BTC-PERP',
    baseAsset: 'BTC',
    quoteAsset: 'USDC',
    venue: 'mock',
    tickSize: 1,
    stepSize: 0.001,
    marketType: 'perp',
    ...overrides,
  }
}

export function makeFill(overrides: Partial<Fill> = {}): Fill {
  return {
    identifier: 'fill-1',
    orderIdentifier: 'order-1',
    symbol: 'BTC',
    side: 'sell',
    price: 104_000,
    size: 0.5,
    fee: 1.2,
    timestamp: 1_700_000_000_000,
    closedPnl: 124,
    direction: 'Close Long',
    ...overrides,
  }
}
