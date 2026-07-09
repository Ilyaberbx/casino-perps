import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { VenueContext } from '@/modules/shared/providers/venue-provider/venue-provider.context'
import { SpectateContext } from '@/modules/spectate/providers/spectate-provider/spectate-provider.context'
import type { SpectateContextValue } from '@/modules/spectate'
import { SelectedMarketContext } from '../../../providers/selected-market-provider/selected-market-provider.context'
import type { Venue } from '@/modules/shared/domain/venue'
import type { MarketDataReader, Trade } from '@/modules/shared/domain'
import type { WalletAddress } from '@/modules/shared/domain/wallet-address'
import { TradesTape } from '../TradesTape'

const noopUnsubscribe = () => {}

function buildVenue(
  subscribeTrades: MarketDataReader['subscribeTrades'],
  explorerTxUrl?: (hash: string) => string,
): Venue {
  return {
    metadata: { id: 'mock', label: 'Mock', explorerTxUrl },
    capabilities: {
      connection: { status: () => 'connected' as const, subscribe: () => noopUnsubscribe },
      marketData: {
        refresh: () => Promise.resolve(),
        listMarkets: () => [],
        subscribeMarkets: () => noopUnsubscribe,
        subscribeOrderbook: () => noopUnsubscribe,
        subscribeTrades,
        subscribeTicker: () => noopUnsubscribe,
      },
    },
  }
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

function renderTape(
  subscribeTrades: MarketDataReader['subscribeTrades'],
  options: { compact?: boolean; explorerTxUrl?: (hash: string) => string } = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SpectateContext.Provider value={mockSpectate}>
        <VenueContext.Provider value={buildVenue(subscribeTrades, options.explorerTxUrl)}>
          <SelectedMarketContext.Provider value={mockMarketContext}>
            {children}
          </SelectedMarketContext.Provider>
        </VenueContext.Provider>
      </SpectateContext.Provider>
    )
  }
  return render(
    <TradesTape sizeAsset="base" baseSymbol="BTC" quoteSymbol="USD" compact={options.compact} />,
    { wrapper: Wrapper },
  )
}

function buildTrade(): Trade {
  return { identifier: 't1', symbol: 'BTC-PERP', side: 'buy', price: 50000, size: 0.25, timestamp: 1_000_000 }
}

function buildTradeWithParticipants(): Trade {
  return {
    ...buildTrade(),
    takerAddress: '0x1111111111111111111111111111111111111111' as WalletAddress,
    makerAddress: '0x2222222222222222222222222222222222222222' as WalletAddress,
  }
}

describe('TradesTape', () => {
  it('shows the loading skeleton until the trades snapshot arrives', () => {
    renderTape(() => noopUnsubscribe)
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0)
  })

  it('shows the "No recent trades" empty state once the snapshot is empty', () => {
    renderTape((_symbol, onUpdate) => {
      onUpdate({ kind: 'snapshot', trades: [] })
      return noopUnsubscribe
    })
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument()
    expect(screen.getByText('No recent trades')).toBeInTheDocument()
  })

  it('renders the tape (no skeleton, no empty state) once the snapshot has trades', () => {
    renderTape((_symbol, onUpdate) => {
      onUpdate({ kind: 'snapshot', trades: [buildTrade()] })
      return noopUnsubscribe
    })
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument()
    expect(screen.queryByText('No recent trades')).not.toBeInTheDocument()
  })

  it('shows the Taker/Maker and TX header columns by default', () => {
    renderTape(
      (_symbol, onUpdate) => {
        onUpdate({ kind: 'snapshot', trades: [buildTradeWithParticipants()] })
        return noopUnsubscribe
      },
      { explorerTxUrl: (hash) => `https://explorer/${hash}` },
    )
    expect(screen.getByText('T')).toBeInTheDocument()
    expect(screen.getByText('M')).toBeInTheDocument()
    expect(screen.getByText('TX')).toBeInTheDocument()
  })

  it('compact mode drops the Taker/Maker and TX columns, keeping Time/Price/Size', () => {
    renderTape(
      (_symbol, onUpdate) => {
        onUpdate({ kind: 'snapshot', trades: [buildTradeWithParticipants()] })
        return noopUnsubscribe
      },
      { compact: true, explorerTxUrl: (hash) => `https://explorer/${hash}` },
    )
    expect(screen.queryByText('T')).not.toBeInTheDocument()
    expect(screen.queryByText('M')).not.toBeInTheDocument()
    expect(screen.queryByText('TX')).not.toBeInTheDocument()
    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getByText('Price')).toBeInTheDocument()
  })
})
