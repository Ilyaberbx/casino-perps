import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Market, MarketDataReader } from '@/modules/shared/domain'
import {
  makeVenue,
  makeVenueWrapper,
  makeMarketDataReader,
} from '@/modules/shared/providers/venue-provider/__fixtures__/venue'
import { useLobby } from '../use-lobby'
import type { LobbyCarouselContent, LobbyFocusedContent } from '../../lobby.types'

// The favorites / recent stores are trading-module state. `import/no-restricted-paths`
// forbids a lobby test from deep-importing trading's __fixtures__ (tests are not
// exempt from the zone), so the public barrel is mocked instead — which is also
// what keeps this a *unit* test of the lobby rather than a mount of the whole
// trading module.
// `current: null` models "the provider is not mounted" — the case the *Optional
// hooks exist for.
const favorites = vi.hoisted(() => ({
  current: null as { favoriteSymbols: ReadonlySet<string> } | null,
}))
const recent = vi.hoisted(() => ({
  current: null as { recentSymbols: ReadonlyArray<string> } | null,
}))

vi.mock('@/modules/trading', () => ({
  useFavoritesOptional: () => favorites.current,
  useRecentMarketsOptional: () => recent.current,
}))

function starred(...symbols: string[]) {
  favorites.current = { favoriteSymbols: new Set(symbols) }
}

function visited(...symbols: string[]) {
  recent.current = { recentSymbols: symbols }
}

function market(symbol: string, volume24h: number, change24hPct?: number): Market {
  return {
    symbol,
    baseAsset: symbol,
    quoteAsset: 'USDC',
    venue: 'hl',
    tickSize: 0,
    stepSize: 0,
    marketType: 'perp',
    volume24h,
    change24hPct,
  }
}

function wrapperWithMarkets(markets: Market[], route = '/') {
  const reader: MarketDataReader = {
    ...makeMarketDataReader(),
    listMarkets: () => markets,
  }
  const VenueWrapper = makeVenueWrapper(makeVenue({ marketData: reader }))
  return ({ children }: { children: ReactNode }) =>
    createElement(
      MemoryRouter,
      { initialEntries: [route] },
      createElement(VenueWrapper, null, children),
    )
}

function renderLobby(markets: Market[], route = '/') {
  return renderHook(() => useLobby(), { wrapper: wrapperWithMarkets(markets, route) })
}

function carousels(content: LobbyCarouselContent | LobbyFocusedContent): LobbyCarouselContent {
  if (content.kind !== 'carousels') throw new Error(`expected carousels, got ${content.kind}`)
  return content
}

function focused(content: LobbyCarouselContent | LobbyFocusedContent): LobbyFocusedContent {
  if (content.kind !== 'focused') throw new Error(`expected focused, got ${content.kind}`)
  return content
}

const MARKETS = [market('A', 10), market('B', 900), market('C', 500), market('D', 20)]

describe('useLobby', () => {
  beforeEach(() => {
    starred()
    visited()
  })

  describe('the `all` view (bare `/`)', () => {
    it('is loading with three empty sections before any market lands', () => {
      const { result } = renderLobby([])
      expect(result.current.isLoading).toBe(true)
      expect(carousels(result.current.content).sections.map((s) => s.id)).toEqual([
        'hot',
        'new',
        'all',
      ])
      expect(carousels(result.current.content).sections.every((s) => s.markets.length === 0)).toBe(
        true,
      )
    })

    it('labels the three sections Hot / New / All', () => {
      const { result } = renderLobby([market('BTC-PERP', 100)])
      expect(carousels(result.current.content).sections.map((s) => s.title)).toEqual([
        'Hot Markets',
        'New Listings',
        'All Markets',
      ])
    })

    it('clears loading and ranks Hot by volume once markets are present', () => {
      const { result } = renderLobby(MARKETS)
      expect(result.current.isLoading).toBe(false)
      const hot = carousels(result.current.content).sections.find((s) => s.id === 'hot')
      expect(hot?.markets.map((m) => m.symbol)).toEqual(['B', 'C', 'D', 'A'])
    })

    it('renders the carousels for an explicit `?view=all`', () => {
      const { result } = renderLobby(MARKETS, '/?view=all')
      expect(result.current.view).toBe('all')
      expect(result.current.content.kind).toBe('carousels')
    })

    // The bug this whole change exists to fix: an unknown view must not render a
    // blank screen — it falls back to the full lobby.
    it('falls back to the carousels for an unrecognised `?view=`', () => {
      const { result } = renderLobby(MARKETS, '/?view=bogus')
      expect(result.current.view).toBe('all')
      expect(result.current.content.kind).toBe('carousels')
    })
  })

  describe('focused views', () => {
    it('`?view=hot` focuses the Hot bucket, ranked by volume', () => {
      const { result } = renderLobby(MARKETS, '/?view=hot')
      const content = focused(result.current.content)
      expect(content.view).toBe('hot')
      expect(content.markets.map((m) => m.symbol)).toEqual(['B', 'C', 'D', 'A'])
    })

    it('`?view=new` focuses the New Listings bucket', () => {
      const { result } = renderLobby(MARKETS, '/?view=new')
      const content = focused(result.current.content)
      expect(content.view).toBe('new')
      // With 4 markets and a 12-wide Hot bucket, Hot swallows everything and New
      // is empty — the buckets stay disjoint. `build-lobby-sections` owns that
      // policy; this only asserts the view routes to the right bucket.
      expect(content.markets).toEqual([])
    })

    it('`?view=hot` and `?view=new` do not render the same thing', () => {
      const hot = renderLobby(MARKETS, '/?view=hot')
      const listings = renderLobby(MARKETS, '/?view=new')
      expect(focused(hot.result.current.content).markets).not.toEqual(
        focused(listings.result.current.content).markets,
      )
    })

    it('`?view=favorites` filters the universe by the starred symbols, in universe order', () => {
      starred('C', 'A')
      const { result } = renderLobby(MARKETS, '/?view=favorites')
      const content = focused(result.current.content)
      expect(content.view).toBe('favorites')
      // Universe order (A before C), NOT the Set's insertion order (C before A).
      expect(content.markets.map((m) => m.symbol)).toEqual(['A', 'C'])
    })

    it('`?view=favorites` drops a starred symbol the venue no longer lists', () => {
      starred('A', 'DELISTED')
      const { result } = renderLobby(MARKETS, '/?view=favorites')
      expect(focused(result.current.content).markets.map((m) => m.symbol)).toEqual(['A'])
    })

    it('`?view=recent` preserves recency order, not universe order', () => {
      visited('D', 'B')
      const { result } = renderLobby(MARKETS, '/?view=recent')
      const content = focused(result.current.content)
      expect(content.view).toBe('recent')
      expect(content.markets.map((m) => m.symbol)).toEqual(['D', 'B'])
    })

    it('`?view=recent` drops a visited symbol the venue no longer lists', () => {
      visited('DELISTED', 'B')
      const { result } = renderLobby(MARKETS, '/?view=recent')
      expect(focused(result.current.content).markets.map((m) => m.symbol)).toEqual(['B'])
    })

    it('focuses an empty grid when nothing is starred or visited', () => {
      const { result } = renderLobby(MARKETS, '/?view=favorites')
      expect(focused(result.current.content).markets).toEqual([])
    })

    // Why `useFavoritesOptional` / `useRecentMarketsOptional` exist: their
    // throwing siblings would crash the lobby here instead of degrading.
    it('renders an empty focused grid, without throwing, when neither provider is mounted', () => {
      favorites.current = null
      recent.current = null
      expect(focused(renderLobby(MARKETS, '/?view=favorites').result.current.content).markets).toEqual([])
      expect(focused(renderLobby(MARKETS, '/?view=recent').result.current.content).markets).toEqual([])
    })
  })

  it('is loading (and does not throw) when no venue is mounted', () => {
    const { result } = renderHook(() => useLobby(), {
      wrapper: ({ children }: { children: ReactNode }) => createElement(MemoryRouter, null, children),
    })
    expect(result.current.isLoading).toBe(true)
  })
})
