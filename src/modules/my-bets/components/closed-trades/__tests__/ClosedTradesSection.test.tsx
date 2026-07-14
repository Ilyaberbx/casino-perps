import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClosedTradesSection } from '../ClosedTradesSection'
import type { ClosedTradeRow } from '../../../my-bets.types'

const PROFIT: ClosedTradeRow = {
  id: 'a',
  ticker: 'BTC',
  side: 'long',
  pnlUsd: 124,
  isUp: true,
  timestamp: 2,
}
const LOSS: ClosedTradeRow = {
  id: 'b',
  ticker: 'SOL',
  side: 'short',
  pnlUsd: -30,
  isUp: false,
  timestamp: 1,
}

describe('ClosedTradesSection', () => {
  it('renders an empty state when there is no history', () => {
    render(<ClosedTradesSection trades={[]} />)
    expect(screen.getByText('No closed trades yet.')).toBeInTheDocument()
  })

  it('renders a signed realised PnL per closed trade', () => {
    render(<ClosedTradesSection trades={[PROFIT, LOSS]} />)
    const results = screen.getAllByTestId('closed-trade-pnl')
    expect(results[0]).toHaveTextContent('+$124.00')
    expect(results[1]).toHaveTextContent('-$30.00')
    expect(screen.getByText('LONG')).toBeInTheDocument()
    expect(screen.getByText('SHORT')).toBeInTheDocument()
  })
})
