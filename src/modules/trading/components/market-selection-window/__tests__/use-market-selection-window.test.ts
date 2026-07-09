import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { VenueContext } from '../../../../shared/providers/venue-provider/venue-provider.context'
import { SelectedMarketContext } from '../../../providers/selected-market-provider/selected-market-provider.context'
import { FakeFavoritesProvider } from '../../../providers/favorites-provider/__fixtures__/fake-favorites-provider'
import { buildPerpMarket } from '../__fixtures__/fake-markets'
import { useMarketSelectionWindow } from '../use-market-selection-window'
import type { Market } from '../../../../shared/domain/domain.types'
import type { FavoritesContextValue } from '../../../providers/favorites-provider/favorites-provider.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildVenue(markets: Market[] = [buildPerpMarket()]): any {
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      marketData: {
        subscribeMarkets: () => () => {},
        listMarkets: () => markets,
      },
    },
  }
}

const DEFAULT_SELECTED_MARKET = 'BTC-PERP'

function makeSelectedMarketValue() {
  return {
    selectedMarket: DEFAULT_SELECTED_MARKET,
    setSelectedMarket: () => undefined,
    market: buildPerpMarket({ symbol: DEFAULT_SELECTED_MARKET }),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildWrapper(venue: any, favoritesValue?: Partial<FavoritesContextValue>) {
  const selectedMarketValue = makeSelectedMarketValue()
  return function ProviderWrapper({ children }: { children: ReactNode }) {
    return createElement(
      VenueContext.Provider,
      { value: venue },
      createElement(
        SelectedMarketContext.Provider,
        { value: selectedMarketValue },
        createElement(FakeFavoritesProvider, { value: favoritesValue, children }),
      ),
    )
  }
}

const HOOK_PROPS = {
  isOpen: true,
  onClose: () => undefined,
  onSelectMarket: () => undefined,
}

describe('useMarketSelectionWindow', () => {
  describe('SEL-07: deferred query filtering', () => {
    it('displayRows uses deferredQuery not searchQuery for filtering (06-02-T1a)', async () => {
      const venue = buildVenue([
        buildPerpMarket({ symbol: 'BTC-PERP', baseAsset: 'Bitcoin' }),
        buildPerpMarket({ symbol: 'ETH-PERP', baseAsset: 'Ethereum' }),
      ])
      const { result } = renderHook(() => useMarketSelectionWindow(HOOK_PROPS), {
        wrapper: buildWrapper(venue),
      })
      // Initial state: deferredQuery is '' so all markets show
      expect(result.current.displayRows).toHaveLength(2)
      // After a search change, deferredQuery settles after act
      await act(async () => {
        result.current.handleSearchChange('BTC')
      })
      expect(result.current.deferredQuery).toBe('BTC')
      expect(result.current.displayRows).toHaveLength(1)
    })
  })

  describe('WL-02: watchlist tab filter', () => {
    it('watchlistRows respects the active category tab (06-02-T1b)', async () => {
      // Category derives from baseAsset: BTC → crypto, AAPL → stocks.
      const cryptoMarket = buildPerpMarket({
        symbol: 'BTC-PERP',
        baseAsset: 'BTC',
        volume24h: 1_000_000,
      })
      const stockMarket = buildPerpMarket({
        symbol: 'AAPL-PERP',
        baseAsset: 'AAPL',
        volume24h: 1_000_000,
      })
      const venue = buildVenue([cryptoMarket, stockMarket])
      const favoritesValue: Partial<FavoritesContextValue> = {
        favoriteSymbols: new Set(['BTC-PERP', 'AAPL-PERP']),
        isFavorite: (s: string) => s === 'BTC-PERP' || s === 'AAPL-PERP',
        toggleFavorite: () => undefined,
        reconcileFavorites: () => undefined,
      }
      const { result } = renderHook(() => useMarketSelectionWindow(HOOK_PROPS), {
        wrapper: buildWrapper(venue, favoritesValue),
      })
      // In 'all' tab: both favorites should appear in watchlistRows
      expect(result.current.watchlistRows).toHaveLength(2)
      // Switch to 'crypto' tab: only BTC-PERP should appear
      await act(async () => {
        result.current.handleTabChange('crypto')
      })
      expect(result.current.watchlistRows).toHaveLength(1)
      expect(result.current.watchlistRows[0].symbol).toBe('BTC-PERP')
    })
  })

  describe('SEL-07: isFilterStale flag', () => {
    it('isFilterStale is false at initial render with empty query (06-02-T1c)', () => {
      const venue = buildVenue()
      const { result } = renderHook(() => useMarketSelectionWindow(HOOK_PROPS), {
        wrapper: buildWrapper(venue),
      })
      // At rest: deferredQuery === searchQuery (both '') → not stale
      expect(result.current.isFilterStale).toBe(false)
    })
  })

  describe('scaffold: wrapper sanity check', () => {
    it('buildWrapper constructs a valid context for hook tests', () => {
      const venue = buildVenue()
      const wrapper = buildWrapper(venue)
      const { result } = renderHook(() => null, { wrapper })
      expect(result.current).toBeNull()
    })
  })
})
