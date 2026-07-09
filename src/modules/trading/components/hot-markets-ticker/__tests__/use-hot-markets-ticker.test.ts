import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { Market } from '@/modules/shared/domain'
import { useVenueOptional } from '@/modules/shared/providers/venue-provider'
import { useHotMarketsTicker } from '../use-hot-markets-ticker'

vi.mock('@/modules/shared/providers/venue-provider', () => ({
  useVenueOptional: vi.fn(),
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()] as const,
}))

const mockedUseVenue = vi.mocked(useVenueOptional)

function market(symbol: string, volume24h: number, change24hPct: number): Market {
  return {
    symbol,
    baseAsset: symbol.replace('-PERP', ''),
    quoteAsset: 'USD',
    venue: 'hl',
    tickSize: 0.01,
    stepSize: 0.001,
    marketType: 'perp',
    volume24h,
    change24hPct,
  }
}

/**
 * A controllable market-data store: holds a mutable `markets` array reference
 * (replaced on every "tick" to mirror the real store) and notifies the hook's
 * subscriber so `useSyncExternalStore` re-runs.
 */
function makeStore(initial: Market[]) {
  let current = initial
  let notify: () => void = () => {}
  const venue = {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected' as const, subscribe: () => () => {} },
      marketData: {
        refresh: async () => {},
        listMarkets: () => current,
        subscribeMarkets: (onChange: () => void) => {
          notify = onChange
          return () => {}
        },
        subscribeOrderbook: () => () => {},
        subscribeTrades: () => () => {},
        subscribeTicker: () => () => {},
      },
    },
  }
  function tick(next: Market[]) {
    current = next
    act(() => notify())
  }
  return { venue, tick }
}

describe('useHotMarketsTicker stable-key memoization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the top-N order stable across a price-only tick (no bucket change) while refreshing live fields', () => {
    const store = makeStore([
      market('BTC-PERP', 5_000_000, 0.01),
      market('ETH-PERP', 3_000_000, 0.02),
    ])
    // The mock returns the same venue object each render — this hook re-runs on
    // ticks, so the venue identity must be stable.
    mockedUseVenue.mockReturnValue(store.venue as never)

    const { result } = renderHook(() => useHotMarketsTicker())
    const firstOrder = result.current.hotMarkets.map((m) => m.symbol)
    expect(firstOrder).toEqual(['BTC-PERP', 'ETH-PERP'])

    // Price-only tick: volumes wiggle far below the significant-figure cutoff, so
    // the stability signal is unchanged; only change24hPct moves.
    store.tick([
      market('BTC-PERP', 5_000_001, 0.05),
      market('ETH-PERP', 3_000_001, 0.09),
    ])

    // Order held...
    expect(result.current.hotMarkets.map((m) => m.symbol)).toEqual(firstOrder)
    // ...but the live 24h % refreshed to the latest Market objects.
    expect(result.current.hotMarkets.map((m) => m.change24hPct)).toEqual([0.05, 0.09])
  })

  it('re-ranks when a real volume move crosses the bucket and reorders the top-N', () => {
    const store = makeStore([
      market('BTC-PERP', 5_000_000, 0),
      market('ETH-PERP', 3_000_000, 0),
    ])
    mockedUseVenue.mockReturnValue(store.venue as never)

    const { result } = renderHook(() => useHotMarketsTicker())
    expect(result.current.hotMarkets.map((m) => m.symbol)).toEqual(['BTC-PERP', 'ETH-PERP'])

    // ETH overtakes BTC by a wide, bucket-crossing margin.
    store.tick([
      market('BTC-PERP', 5_000_000, 0),
      market('ETH-PERP', 9_000_000, 0),
    ])

    expect(result.current.hotMarkets.map((m) => m.symbol)).toEqual(['ETH-PERP', 'BTC-PERP'])
  })
})
