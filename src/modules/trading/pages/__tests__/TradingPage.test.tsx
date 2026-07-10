import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { OrderDraft } from '@/modules/shared/domain'
import { TradingPage } from '../TradingPage'
import type { UseCasinoTradeReturn } from '../../hooks/use-casino-trade'
import type { PendingBet } from '../../hooks/casino-trade.types'

// The chart is a lazy lightweight-charts wrapper; stub it so the page renders
// without a canvas / venue stream.
vi.mock('../../components/chart', () => ({
  LazyChart: () => <div data-testid="mock-chart" />,
}))

// jsdom does not implement <dialog>.show(); stub the Sheet to a simple
// open-gated passthrough so the confirm-sheet body is assertable.
vi.mock('@/modules/shared/components/Sheet', () => ({
  Sheet: ({ isOpen, children }: { isOpen: boolean; children: import('react').ReactNode }) =>
    isOpen ? <div>{children}</div> : null,
}))

const mockUseCasinoTrade = vi.fn<() => UseCasinoTradeReturn>()
vi.mock('../../hooks/use-casino-trade', () => ({
  useCasinoTrade: () => mockUseCasinoTrade(),
}))

const DRAFT: OrderDraft = {
  symbol: 'BTC-PERP',
  orderType: 'market',
  side: 'buy',
  sizeUnit: 'coin',
  sizeInput: '5',
  priceInput: '',
  stopPriceInput: '',
  slippageInput: '',
  timeInForce: 'Gtc',
  twapHoursInput: '',
  twapMinutesInput: '',
  randomize: false,
  reduceOnly: false,
  leverage: 10,
}

function baseReturn(overrides: Partial<UseCasinoTradeReturn> = {}): UseCasinoTradeReturn {
  return {
    ticker: 'BTC',
    markPrice: 104231.5,
    change24hPct: 0.024,
    betPresets: [10, 50, 100],
    betAmount: 50,
    leverage: 10,
    maxLeverage: 40,
    canBet: true,
    pendingBet: null,
    liveBet: null,
    isCashingOut: false,
    selectAmount: vi.fn(),
    selectMax: vi.fn(),
    setMultiplier: vi.fn(),
    openConfirm: vi.fn(),
    closeConfirm: vi.fn(),
    confirmPrimary: vi.fn(),
    cashOut: vi.fn(),
    ...overrides,
  }
}

describe('TradingPage — Casino Mode', () => {
  beforeEach(() => mockUseCasinoTrade.mockReset())

  it('renders the market header, chips, multiplier, and UP/DOWN', () => {
    mockUseCasinoTrade.mockReturnValue(baseReturn())
    render(<TradingPage />)

    expect(screen.getByTestId('casino-market-header')).toHaveTextContent('BTC')
    expect(screen.getByTestId('bet-amount-chips')).toBeInTheDocument()
    expect(screen.getByTestId('multiplier-control')).toHaveTextContent('10x')
    expect(screen.getByTestId('bet-up')).toBeInTheDocument()
    expect(screen.getByTestId('bet-down')).toBeInTheDocument()
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument()
  })

  it('does not mount the confirm sheet until a direction is picked', () => {
    mockUseCasinoTrade.mockReturnValue(baseReturn())
    render(<TradingPage />)
    expect(screen.queryByTestId('confirm-bet-sheet')).not.toBeInTheDocument()
  })

  it('shows the liquidation sentence and magenta Place Bet in the confirm sheet', () => {
    const pendingBet: PendingBet = {
      direction: 'up',
      betAmount: 50,
      leverage: 10,
      ticker: 'BTC',
      liquidationSentence: 'You lose this bet if BTC drops below $94,102',
      cta: 'place-bet',
      draft: DRAFT,
    }
    mockUseCasinoTrade.mockReturnValue(baseReturn({ pendingBet }))
    render(<TradingPage />)

    expect(screen.getByTestId('confirm-liquidation')).toHaveTextContent(
      'You lose this bet if BTC drops below $94,102',
    )
    expect(screen.getByTestId('confirm-primary')).toHaveTextContent('Place Bet')
  })

  it('swaps the CTA to Add Cash when the user has no balance', () => {
    const pendingBet: PendingBet = {
      direction: 'down',
      betAmount: 50,
      leverage: 10,
      ticker: 'BTC',
      liquidationSentence: 'You lose this bet if BTC rises above $114,880',
      cta: 'add-cash',
      draft: DRAFT,
    }
    mockUseCasinoTrade.mockReturnValue(baseReturn({ pendingBet }))
    render(<TradingPage />)
    expect(screen.getByTestId('confirm-primary')).toHaveTextContent('Add Cash')
  })

  it('renders the live-bet row with Cash Out when a bet is open', () => {
    mockUseCasinoTrade.mockReturnValue(
      baseReturn({
        liveBet: {
          direction: 'up',
          leverage: 10,
          profitUsd: 12.5,
          isWinning: true,
          liquidationSentence: 'You lose this bet if BTC drops below $94,102',
        },
      }),
    )
    render(<TradingPage />)
    expect(screen.getByTestId('live-bet-row')).toBeInTheDocument()
    expect(screen.getByTestId('cash-out')).toHaveTextContent('Cash Out')
  })
})
