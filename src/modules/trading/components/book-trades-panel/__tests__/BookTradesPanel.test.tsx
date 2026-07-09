import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { VenueContext } from '@/modules/shared/providers/venue-provider/venue-provider.context'
import { SpectateContext } from '@/modules/spectate/providers/spectate-provider/spectate-provider.context'
import type { SpectateContextValue } from '@/modules/spectate'
import { SelectedMarketContext } from '../../../providers/selected-market-provider/selected-market-provider.context'
import type { Venue } from '@/modules/shared/domain/venue'
import type { MarketDataReader } from '@/modules/shared/domain'
import { BookTradesPanel } from '../BookTradesPanel'

const noopUnsubscribe = () => {}

const mockVenue: Venue = {
  metadata: { id: 'mock', label: 'Mock' },
  capabilities: {
    connection: { status: () => 'connected' as const, subscribe: () => noopUnsubscribe },
    marketData: {
      refresh: () => Promise.resolve(),
      listMarkets: () => [],
      subscribeMarkets: () => noopUnsubscribe,
      subscribeOrderbook: () => noopUnsubscribe,
      subscribeTrades: () => noopUnsubscribe,
      subscribeTicker: () => noopUnsubscribe,
    },
  },
}

/** A venue whose orderbook + trades streams each emit one populated snapshot on
 *  subscribe, so both feature hooks accumulate live state the moment they mount —
 *  even while their tab is inactive. Records subscribe/unsubscribe counts so a
 *  test can prove the inactive panel's stream stays warm. */
function buildLiveVenue(): {
  venue: Venue
  counts: { orderbookSubscribes: number; orderbookUnsubscribes: number; tradesSubscribes: number; tradesUnsubscribes: number }
} {
  const counts = { orderbookSubscribes: 0, orderbookUnsubscribes: 0, tradesSubscribes: 0, tradesUnsubscribes: 0 }
  const subscribeOrderbook: MarketDataReader['subscribeOrderbook'] = (_symbol, onEvent) => {
    counts.orderbookSubscribes += 1
    onEvent({
      kind: 'snapshot',
      symbol: 'BTC-PERP',
      bids: [{ price: 100, size: 2 }],
      asks: [{ price: 101, size: 3 }],
      sequence: 1,
      timestamp: 0,
    })
    return () => {
      counts.orderbookUnsubscribes += 1
    }
  }
  const subscribeTrades: MarketDataReader['subscribeTrades'] = (_symbol, onEvent) => {
    counts.tradesSubscribes += 1
    onEvent({
      kind: 'snapshot',
      trades: [{ identifier: 't1', symbol: 'BTC-PERP', side: 'buy', price: 100, size: 1, timestamp: 1_000 }],
    })
    return () => {
      counts.tradesUnsubscribes += 1
    }
  }
  const venue: Venue = {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected' as const, subscribe: () => noopUnsubscribe },
      marketData: {
        refresh: () => Promise.resolve(),
        listMarkets: () => [],
        subscribeMarkets: () => noopUnsubscribe,
        subscribeOrderbook,
        subscribeTrades,
        subscribeTicker: () => noopUnsubscribe,
      },
    },
  }
  return { venue, counts }
}

const mockSpectate: SpectateContextValue = {
  spectatedAddress: null,
  isSpectating: false,
  startSpectating: vi.fn(),
  stopSpectating: vi.fn(),
  watchlist: [],
  addToWatchlist: vi.fn(),
  removeFromWatchlist: vi.fn(),
  isWatchlisted: () => false,
}

const mockMarketContext = {
  selectedMarket: 'BTC-PERP',
  setSelectedMarket: vi.fn(),
  market: {
    symbol: 'BTC-PERP',
    baseAsset: 'BTC',
    quoteAsset: 'USD',
    venue: 'mock',
    tickSize: 0.5,
    stepSize: 0.001,
    marketType: 'perp' as const,
    hlCoin: 'BTC',
  },
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SpectateContext.Provider value={mockSpectate}>
      <VenueContext.Provider value={mockVenue}>
        <SelectedMarketContext.Provider value={mockMarketContext}>
          {children}
        </SelectedMarketContext.Provider>
      </VenueContext.Provider>
    </SpectateContext.Provider>
  )
}

function renderWithVenue(venue: Venue) {
  return render(<BookTradesPanel />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <SpectateContext.Provider value={mockSpectate}>
        <VenueContext.Provider value={venue}>
          <SelectedMarketContext.Provider value={mockMarketContext}>
            {children}
          </SelectedMarketContext.Provider>
        </VenueContext.Provider>
      </SpectateContext.Provider>
    ),
  })
}

const orderbookPanel = () => screen.getByRole('tabpanel', { name: 'Order Book' })
const tradesPanel = () => screen.getByRole('tabpanel', { name: 'Trades' })

describe('BookTradesPanel', () => {
  it('renders Order Book and Trades tab labels', () => {
    render(<BookTradesPanel />, { wrapper: Wrapper })
    expect(screen.getByRole('tab', { name: /order book/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /trades/i })).toBeInTheDocument()
  })

  it('tab list has listFitted CSS class for full-width equal-segment tabs (D-03)', () => {
    const { container } = render(<BookTradesPanel />, { wrapper: Wrapper })
    const fittedList = container.querySelector('[class*="listFitted"]')
    expect(fittedList).not.toBeNull()
  })

  it('renders the new switchers using the design-system primitives (no raw <select>)', () => {
    render(<BookTradesPanel />, { wrapper: Wrapper })
    // Tick selector → pixel-button IconSelect (button + listbox).
    expect(screen.getByRole('button', { name: 'Price aggregation' })).toBeInTheDocument()
    // Size denomination → SegmentedControl (role=group + pressed buttons).
    expect(screen.getByRole('group', { name: 'Size denomination' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'BTC', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'USD', pressed: false })).toBeInTheDocument()
    // No raw <select> remains.
    expect(document.querySelectorAll('select')).toHaveLength(0)
  })

  it('renders only the active panel body — the inactive panel emits no row subtree while its stream stays subscribed', () => {
    const { venue, counts } = buildLiveVenue()
    renderWithVenue(venue)

    // Order Book is the default active tab → its body (the Total header + a real
    // ladder) renders.
    expect(within(orderbookPanel()).getByText(/^Total \(/)).toBeInTheDocument()

    // The inactive Trades panel renders NO body — its "Time" header (the tell that
    // TradesTape rendered its row subtree) is absent, even though its stream is
    // subscribed and accumulating (its subscribe count is 1).
    expect(within(tradesPanel()).queryByText('Time')).not.toBeInTheDocument()
    expect(counts.tradesSubscribes).toBe(1)
  })

  it('keeps the inactive panel stream subscribed (warm) so switching tabs shows accumulated state with no skeleton', () => {
    const { venue, counts } = buildLiveVenue()
    renderWithVenue(venue)

    // Both streams subscribe on mount even though Trades is inactive (warmth),
    // and neither has torn down.
    expect(counts.orderbookSubscribes).toBe(1)
    expect(counts.tradesSubscribes).toBe(1)
    expect(counts.tradesUnsubscribes).toBe(0)

    // Switch to the Trades tab.
    fireEvent.click(screen.getByRole('tab', { name: /trades/i }))

    // The Trades body now renders (its "Time" header appears) with the state it
    // accumulated while inactive — no re-subscribe, no skeleton flash.
    expect(within(tradesPanel()).getByText('Time')).toBeInTheDocument()
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('skeleton-row')).toHaveLength(0)
    expect(counts.tradesSubscribes).toBe(1)
    expect(counts.orderbookUnsubscribes).toBe(0)

    // The now-inactive Order Book panel drops its row subtree.
    expect(within(orderbookPanel()).queryByText(/^Total \(/)).not.toBeInTheDocument()
  })
})
