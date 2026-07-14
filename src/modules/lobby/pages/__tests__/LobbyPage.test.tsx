import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import type { Market, MarketDataReader } from '@/modules/shared/domain'
import {
  makeVenue,
  makeVenueWrapper,
  makeMarketDataReader,
} from '@/modules/shared/providers/venue-provider/__fixtures__/venue'
import { LobbyPage } from '../LobbyPage'

const favorites = vi.hoisted(() => ({
  current: { favoriteSymbols: new Set<string>() } as { favoriteSymbols: ReadonlySet<string> },
}))
const recent = vi.hoisted(() => ({
  current: { recentSymbols: [] as ReadonlyArray<string> },
}))

vi.mock('@/modules/trading', () => ({
  useFavoritesOptional: () => favorites.current,
  useRecentMarketsOptional: () => recent.current,
}))

function market(symbol: string, volume24h: number): Market {
  return {
    symbol,
    baseAsset: symbol,
    quoteAsset: 'USDC',
    venue: 'hl',
    tickSize: 0,
    stepSize: 0,
    marketType: 'perp',
    volume24h,
  }
}

const MARKETS = [market('BTC', 900), market('ETH', 500), market('SOL', 10)]

function renderLobby(route: string) {
  const reader: MarketDataReader = {
    ...makeMarketDataReader(),
    listMarkets: () => MARKETS,
  }
  const VenueWrapper = makeVenueWrapper(makeVenue({ marketData: reader }))
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[route]}>
      <VenueWrapper>{children}</VenueWrapper>
    </MemoryRouter>
  )
  return render(<LobbyPage />, { wrapper: Wrapper })
}

function view(): string | null {
  return screen.getByTestId('lobby-page').getAttribute('data-view')
}

/**
 * The regression suite for the `?view=` bug: every one of these URLs used to
 * render byte-identical output, because nothing on the lobby side read the param.
 */
describe('LobbyPage', () => {
  describe('the full lobby', () => {
    it('renders the hero and all three carousels on the bare `/`', () => {
      renderLobby('/')
      expect(view()).toBe('all')
      expect(screen.getByRole('region', { name: 'Hot Markets' })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'New Listings' })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'All Markets' })).toBeInTheDocument()
    })

    it('renders the full lobby for an unrecognised view rather than a blank screen', () => {
      renderLobby('/?view=bogus')
      expect(view()).toBe('all')
      expect(screen.getByRole('region', { name: 'Hot Markets' })).toBeInTheDocument()
    })
  })

  describe('focused views', () => {
    it('`?view=hot` renders only the Hot grid — no other section', () => {
      renderLobby('/?view=hot')
      expect(view()).toBe('hot')
      expect(screen.getByRole('region', { name: 'Hot Markets' })).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'New Listings' })).not.toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'All Markets' })).not.toBeInTheDocument()
    })

    it('`?view=new` renders only the New Listings section', () => {
      renderLobby('/?view=new')
      expect(view()).toBe('new')
      expect(screen.getByRole('region', { name: 'New Listings' })).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Hot Markets' })).not.toBeInTheDocument()
    })

    it('`?view=favorites` shows how to fill an empty Favorites view', () => {
      favorites.current = { favoriteSymbols: new Set() }
      renderLobby('/?view=favorites')
      expect(view()).toBe('favorites')
      expect(screen.getByText('Star a market to see it here.')).toBeInTheDocument()
    })

    it('`?view=favorites` lists the starred markets once there are some', () => {
      favorites.current = { favoriteSymbols: new Set(['ETH']) }
      renderLobby('/?view=favorites')
      expect(screen.getByRole('link', { name: 'ETH' })).toHaveAttribute('href', '/trade/ETH')
      expect(screen.queryByRole('link', { name: 'BTC' })).not.toBeInTheDocument()
    })

    it('`?view=recent` shows how to fill an empty Recent view', () => {
      recent.current = { recentSymbols: [] }
      renderLobby('/?view=recent')
      expect(view()).toBe('recent')
      expect(screen.getByText('Markets you visit will appear here.')).toBeInTheDocument()
    })

    it('`?view=recent` lists visited markets most-recent-first', () => {
      recent.current = { recentSymbols: ['SOL', 'BTC'] }
      renderLobby('/?view=recent')
      const links = screen.getAllByRole('link').map((el) => el.getAttribute('aria-label'))
      expect(links).toEqual(['SOL', 'BTC'])
    })
  })

  // The bug, stated as a test: these three URLs must not be the same screen.
  it('renders a different screen per view', () => {
    const lobby = renderLobby('/').container.innerHTML
    const hot = renderLobby('/?view=hot').container.innerHTML
    const listings = renderLobby('/?view=new').container.innerHTML
    expect(hot).not.toEqual(lobby)
    expect(listings).not.toEqual(lobby)
    expect(hot).not.toEqual(listings)
  })
})
