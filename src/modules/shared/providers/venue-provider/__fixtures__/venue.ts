import { createElement, type ReactNode } from 'react'
import type {
  Venue,
  VenueCapabilities,
  ConnectionStatusSource,
  MarketDataReader,
} from '@/modules/shared/domain'
import { VenueProvider } from '../VenueProvider'

const noopUnsubscribe = () => {}

export function makeConnectionSource(): ConnectionStatusSource {
  return {
    status: () => 'connected',
    subscribe: () => noopUnsubscribe,
  }
}

export function makeMarketDataReader(): MarketDataReader {
  return {
    refresh: async () => {},
    listMarkets: () => [],
    subscribeMarkets: () => noopUnsubscribe,
    subscribeOrderbook: () => noopUnsubscribe,
    subscribeTrades: () => noopUnsubscribe,
    subscribeTicker: () => noopUnsubscribe,
  }
}

/**
 * Minimal `Venue` for venue-provider hook tests. `connection` is always present
 * (it is a required capability); pass any optional slots to override.
 */
export function makeVenue(capabilities: Partial<VenueCapabilities> = {}): Venue {
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: makeConnectionSource(),
      ...capabilities,
    },
  }
}

export function makeVenueWrapper(venue: Venue) {
  return ({ children }: { children: ReactNode }) =>
    createElement(VenueProvider, { venue, children })
}
