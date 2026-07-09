import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TradeEquityCard } from '../TradeEquityCard'
import { buildEquityCardVenue, wrapEquityCard } from '../__fixtures__/equity-card-venue'

describe('TradeEquityCard', () => {
  beforeEach(() => localStorage.clear())

  it('Pro mode shows the full breakdown and the three funding actions', () => {
    render(<TradeEquityCard />, { wrapper: wrapEquityCard(buildEquityCardVenue(true), 'pro') })

    // Headline + badge stay.
    expect(screen.getByText('$3.03')).toBeInTheDocument()
    // Full breakdown rows.
    expect(screen.getByText('Maintenance Margin')).toBeInTheDocument()
    expect(screen.getByText('Cross Account Leverage')).toBeInTheDocument()
    expect(screen.getByText('Vault Equity')).toBeInTheDocument()
    expect(screen.getByText('Earn Balance')).toBeInTheDocument()
    expect(screen.getByText('Staking Account')).toBeInTheDocument()
    // Three funding actions.
    expect(screen.getByRole('button', { name: 'Deposit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Transfer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Manage Funds' })).not.toBeInTheDocument()
  })

  it('Simple mode keeps headline + Spot/Perps/uPNL and a single Manage Funds button', () => {
    render(<TradeEquityCard />, { wrapper: wrapEquityCard(buildEquityCardVenue(true), 'simple') })

    expect(screen.getByText('$3.03')).toBeInTheDocument()
    expect(screen.getByText('Spot')).toBeInTheDocument()
    expect(screen.getByText('Perps')).toBeInTheDocument()
    expect(screen.getByText('Unrealized PNL')).toBeInTheDocument()

    // Hidden detail rows.
    expect(screen.queryByText('Maintenance Margin')).not.toBeInTheDocument()
    expect(screen.queryByText('Cross Account Leverage')).not.toBeInTheDocument()
    expect(screen.queryByText('Vault Equity')).not.toBeInTheDocument()
    expect(screen.queryByText('Earn Balance')).not.toBeInTheDocument()
    expect(screen.queryByText('Staking Account')).not.toBeInTheDocument()

    // Single funding button replaces the three actions.
    expect(screen.getByRole('button', { name: 'Manage Funds' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deposit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Transfer' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument()
  })
})
