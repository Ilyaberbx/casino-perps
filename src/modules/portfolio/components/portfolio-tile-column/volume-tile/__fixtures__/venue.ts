import type { Venue, PortfolioSnapshot } from '@/modules/shared/domain'

export const SNAPSHOT_WITH_VOLUME: PortfolioSnapshot = {
  accountValue: 10_000,
  pnl: { '24H': 100, '7D': 100, '30D': 100, AllTime: 100 },
  perpsPnl: 50,
  volume: { '24H': 5_000, '7D': 5_000, '30D': 5_000, AllTime: 5_000 },
  spotEquity: 4_000,
  perpsEquity: 6_000,
  fourteenDayVolume: 123_456.78,
  timestamp: 1,
}

export function buildVenueWithPortfolio(snapshot: PortfolioSnapshot): Venue {
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      portfolio: {
        subscribeSnapshot: (_scope, cb) => {
          cb(snapshot)
          return () => {}
        },
        getHistory: () => {
          throw new Error('not used in volume tile tests')
        },
      },
    },
  }
}

/** A portfolio capability that never emits — models the pre-first-snapshot (loading) state. */
export function buildVenueWithPendingPortfolio(): Venue {
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      portfolio: {
        subscribeSnapshot: () => () => {},
        getHistory: () => {
          throw new Error('not used in volume tile tests')
        },
      },
    },
  }
}

export function buildVenueWithoutPortfolio(): Venue {
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
    },
  }
}
