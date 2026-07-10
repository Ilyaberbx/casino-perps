import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LiveBetsSection } from '../LiveBetsSection'
import type { LiveBet } from '../../../my-bets.types'

const BET: LiveBet = {
  symbol: 'BTC-PERP',
  ticker: 'BTC',
  direction: 'up',
  leverage: 10,
  profitUsd: 124,
  isWinning: true,
  liquidationSentence: 'You lose this bet if BTC drops below $94,102',
  isCashingOut: false,
}

describe('LiveBetsSection', () => {
  it('renders an empty state when there are no bets', () => {
    render(<LiveBetsSection bets={[]} onCashOut={vi.fn()} />)
    expect(screen.getByText('No live bets. Pick a game to place one.')).toBeInTheDocument()
  })

  it('renders a bet row with the profit and liquidation prose', () => {
    render(<LiveBetsSection bets={[BET]} onCashOut={vi.fn()} />)
    expect(screen.getByText('BTC')).toBeInTheDocument()
    expect(screen.getByText('UP 10x')).toBeInTheDocument()
    expect(screen.getByTestId('live-bet-profit')).toHaveTextContent('+$124.00')
    expect(
      screen.getByText('You lose this bet if BTC drops below $94,102'),
    ).toBeInTheDocument()
  })

  it('cashes out the bet by symbol', async () => {
    const onCashOut = vi.fn()
    render(<LiveBetsSection bets={[BET]} onCashOut={onCashOut} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cash Out' }))
    expect(onCashOut).toHaveBeenCalledWith('BTC-PERP')
  })

  it('disables the button and shows progress while cashing out', () => {
    render(<LiveBetsSection bets={[{ ...BET, isCashingOut: true }]} onCashOut={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Cashing Out…' })
    expect(button).toBeDisabled()
  })
})
