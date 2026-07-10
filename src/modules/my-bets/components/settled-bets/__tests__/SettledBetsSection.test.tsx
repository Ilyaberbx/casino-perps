import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SettledBetsSection } from '../SettledBetsSection'
import type { SettledBet } from '../../../my-bets.types'

const WIN: SettledBet = {
  id: 'a',
  ticker: 'BTC',
  direction: 'up',
  profitUsd: 124,
  isWin: true,
  timestamp: 2,
}
const LOSS: SettledBet = {
  id: 'b',
  ticker: 'SOL',
  direction: 'down',
  profitUsd: -30,
  isWin: false,
  timestamp: 1,
}

describe('SettledBetsSection', () => {
  it('renders an empty state when there is no history', () => {
    render(<SettledBetsSection bets={[]} />)
    expect(screen.getByText('No settled bets yet.')).toBeInTheDocument()
  })

  it('renders a signed result per settled bet', () => {
    render(<SettledBetsSection bets={[WIN, LOSS]} />)
    const results = screen.getAllByTestId('settled-bet-result')
    expect(results[0]).toHaveTextContent('+$124.00')
    expect(results[1]).toHaveTextContent('-$30.00')
    expect(screen.getByText('BTC')).toBeInTheDocument()
    expect(screen.getByText('SOL')).toBeInTheDocument()
  })
})
