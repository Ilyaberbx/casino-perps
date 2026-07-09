import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileSimpleBook } from '../MobileSimpleBook'
import { SIMPLE_BOOK_DEPTH } from '../mobile-simple-book.constants'

vi.mock('../use-mobile-simple-book', () => ({
  useMobileSimpleBook: () => ({ tick: 0, sizeAsset: 'base', baseSymbol: 'BTC', quoteSymbol: 'USDC' }),
}))
vi.mock('../../orderbook', () => ({
  Orderbook: (props: { visibleDepth?: number }) => (
    <div data-testid="mock-orderbook" data-depth={props.visibleDepth} />
  ),
}))
vi.mock('../../trades-tape', () => ({
  TradesTape: (props: { compact?: boolean }) => (
    <div data-testid="mock-trades-tape" data-compact={String(props.compact ?? false)} />
  ),
}))

describe('MobileSimpleBook', () => {
  it('stacks a shallow order book over a compact trades tape', () => {
    render(<MobileSimpleBook />)

    expect(screen.getByTestId('mock-orderbook')).toHaveAttribute('data-depth', String(SIMPLE_BOOK_DEPTH))
    expect(screen.getByTestId('mock-trades-tape')).toHaveAttribute('data-compact', 'true')
  })

  it('labels both sections of the combined panel', () => {
    render(<MobileSimpleBook />)

    expect(screen.getByText('Order Book')).toBeInTheDocument()
    expect(screen.getByText('Recent Trades')).toBeInTheDocument()
  })
})
