import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { VenueContext } from '../../../../shared/providers/venue-provider/venue-provider.context'
import { SelectedMarketContext } from '../../../providers/selected-market-provider/selected-market-provider.context'
import { FakeFavoritesProvider } from '../../../providers/favorites-provider/__fixtures__/fake-favorites-provider'
import { buildPerpMarket, buildSpotMarket, buildHip3Market } from '../__fixtures__/fake-markets'
import { MarketSelectionWindow } from '../MarketSelectionWindow'
import type { Market } from '../../../../shared/domain/domain.types'
import type { FavoritesContextValue } from '../../../providers/favorites-provider/favorites-provider.types'

const DEFAULT_MARKET = buildPerpMarket({ symbol: 'BTC-PERP' })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildVenue(markets: Market[] = [DEFAULT_MARKET]): any {
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

const DEFAULT_SELECTED_MARKET_VALUE = {
  selectedMarket: 'BTC-PERP' as string,
  setSelectedMarket: () => undefined,
  market: DEFAULT_MARKET,
}

interface WrapperOptions {
  venue?: ReturnType<typeof buildVenue>
  favoritesValue?: Partial<FavoritesContextValue>
}

function makeWrapper({ venue, favoritesValue }: WrapperOptions = {}) {
  const resolvedVenue = venue ?? buildVenue()
  return function ProviderWrapper({ children }: { children: ReactNode }) {
    return createElement(
      VenueContext.Provider,
      { value: resolvedVenue },
      createElement(
        SelectedMarketContext.Provider,
        { value: DEFAULT_SELECTED_MARKET_VALUE },
        createElement(FakeFavoritesProvider, { value: favoritesValue, children }),
      ),
    )
  }
}

const BASE_PROPS = {
  isOpen: true,
  onClose: () => undefined,
  onSelectMarket: () => undefined,
  selectedMarket: 'BTC-PERP',
}

describe('MarketSelectionWindow', () => {
  describe('SEL-01: window renders and tabs', () => {
    it('renders when isOpen=true (06-03-T1a)', () => {
      render(<MarketSelectionWindow {...BASE_PROPS} />, {
        wrapper: makeWrapper(),
      })
      expect(screen.getByRole('dialog', { name: /select market/i })).toBeInTheDocument()
    })

    it('TabBar renders the Minara asset-class tabs (ALL / CRYPTO / STOCKS / … / PRE-IPO)', () => {
      render(<MarketSelectionWindow {...BASE_PROPS} />, {
        wrapper: makeWrapper(),
      })
      expect(screen.getByRole('tab', { name: /^all$/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /crypto/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /stocks/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /commodities/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /indices/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /^fx$/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /pre-ipo/i })).toBeInTheDocument()
      // The old market-TYPE tabs are gone (ADR-0014 amendment).
      expect(screen.queryByRole('tab', { name: /perps/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: /hip-3/i })).not.toBeInTheDocument()
    })

    it('clicking a market row calls onSelectMarket(symbol) and closes the window (06-03-T1h)', async () => {
      const user = userEvent.setup()
      const onSelectMarket = vi.fn()
      const markets = [buildPerpMarket({ symbol: 'BTC-PERP', baseAsset: 'Bitcoin' })]
      render(<MarketSelectionWindow {...BASE_PROPS} onSelectMarket={onSelectMarket} />, {
        wrapper: makeWrapper({ venue: buildVenue(markets) }),
      })
      // The row label/aria-label show the stripped 'BTC'; the onSelect payload
      // keeps the '-PERP' routing identity symbol (ADR-0016 amendment).
      const rowButton = screen.getByRole('button', { name: /select btc/i })
      await user.click(rowButton)
      expect(onSelectMarket).toHaveBeenCalledWith('BTC-PERP')
    })
  })

  describe('SEL-05: loading and empty states', () => {
    it('renders loading placeholder when markets array is empty (06-03-T1c)', () => {
      render(<MarketSelectionWindow {...BASE_PROPS} />, {
        wrapper: makeWrapper({ venue: buildVenue([]) }),
      })
      // PlaceholderMessage renders children ("Fetching market data…") when provided,
      // not the message prop ("LOADING MARKETS") — children takes precedence.
      expect(screen.getByText(/fetching market data/i)).toBeInTheDocument()
    })
  })

  describe('asset-class category tabs + volume filter (Minara 1:1, ADR-0062)', () => {
    it('the STOCKS tab shows only stock markets, hiding crypto', async () => {
      const user = userEvent.setup()
      // Category derives from baseAsset: AAPL → stocks, BTC → crypto.
      const markets = [
        buildHip3Market({ symbol: 'xyz:AAPL', baseAsset: 'AAPL', volume24h: 1_000_000 }),
        buildPerpMarket({ symbol: 'BTC-PERP', baseAsset: 'BTC', volume24h: 1_000_000 }),
      ]
      render(<MarketSelectionWindow {...BASE_PROPS} />, {
        wrapper: makeWrapper({ venue: buildVenue(markets) }),
      })
      // ALL tab: both rows render.
      expect(screen.getAllByRole('button', { name: /^Select/i })).toHaveLength(2)
      await user.click(screen.getByRole('tab', { name: /stocks/i }))
      const stockRows = screen.getAllByRole('button', { name: /^Select/i })
      expect(stockRows).toHaveLength(1)
    })

    it('keeps a liquid spot asset but hides one below the $500k volume floor', () => {
      const markets = [
        buildSpotMarket({ symbol: 'SOL/USDC', baseAsset: 'SOL', volume24h: 1_000_000 }),
        buildPerpMarket({ symbol: 'DUST-PERP', baseAsset: 'BTC', volume24h: 1_000 }),
      ]
      render(<MarketSelectionWindow {...BASE_PROPS} />, {
        wrapper: makeWrapper({ venue: buildVenue(markets) }),
      })
      // The spot asset survives; the sub-threshold market is filtered out.
      const rows = screen.getAllByRole('button', { name: /^Select/i })
      expect(rows).toHaveLength(1)
    })
  })

  describe('WL-02: watchlist section visibility', () => {
    it('WatchlistSection is hidden when watchlistRows is empty (06-03-T1f)', () => {
      render(<MarketSelectionWindow {...BASE_PROPS} />, {
        wrapper: makeWrapper({ favoritesValue: { favoriteSymbols: new Set() } }),
      })
      expect(screen.queryByText(/watchlist/i)).not.toBeInTheDocument()
    })

    it('WatchlistSection shows favorites matching the active tab (06-03-T1g)', () => {
      const favoriteSymbols = new Set(['BTC-PERP'])
      const favoritesValue: Partial<FavoritesContextValue> = {
        favoriteSymbols,
        isFavorite: (s: string) => favoriteSymbols.has(s),
      }
      const markets = [buildPerpMarket({ symbol: 'BTC-PERP', baseAsset: 'Bitcoin' })]
      render(<MarketSelectionWindow {...BASE_PROPS} />, {
        wrapper: makeWrapper({ venue: buildVenue(markets), favoritesValue }),
      })
      expect(screen.getByText(/watchlist/i)).toBeInTheDocument()
    })
  })
})

// Suppress unused import warnings
void buildSpotMarket
