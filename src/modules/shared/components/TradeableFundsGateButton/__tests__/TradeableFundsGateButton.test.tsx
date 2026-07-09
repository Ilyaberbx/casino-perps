import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { okAsync } from 'neverthrow'
import type {
  PortfolioAccountScope,
  PortfolioReader,
  PortfolioSnapshot,
} from '@/modules/shared/domain'
import { TradeableFundsGateButton } from '../TradeableFundsGateButton'
import {
  makeVenue,
  makeVenueWrapper,
} from '../../../providers/venue-provider/__fixtures__/venue'

function buildSnapshot(accountValue: number): PortfolioSnapshot {
  return {
    accountValue,
    pnl: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
    perpsPnl: 0,
    volume: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
    spotEquity: 0,
    perpsEquity: accountValue,
    fourteenDayVolume: 0,
    timestamp: 0,
  }
}

// `snapshot === null` ⇒ subscribe never emits (the gate stays in `checking`).
function makePortfolio(snapshot: PortfolioSnapshot | null): PortfolioReader {
  return {
    subscribeSnapshot: (_scope, onUpdate) => {
      if (snapshot !== null) onUpdate(snapshot)
      return () => {}
    },
    getHistory: () => okAsync([]),
  }
}

function renderGate(portfolio: PortfolioReader | undefined) {
  const venue = makeVenue(portfolio ? { portfolio } : {})
  return render(
    <TradeableFundsGateButton>
      <button type="submit">Place Order</button>
    </TradeableFundsGateButton>,
    { wrapper: makeVenueWrapper(venue) },
  )
}

describe('TradeableFundsGateButton', () => {
  it('renders children when perp accountValue > 0', () => {
    renderGate(makePortfolio(buildSnapshot(123.45)))
    expect(screen.getByRole('button', { name: 'Place Order' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /deposit to trade/i })).not.toBeInTheDocument()
  })

  it('renders a disabled "Deposit to trade" button (not children) when accountValue == 0', () => {
    renderGate(makePortfolio(buildSnapshot(0)))
    const deposit = screen.getByRole('button', { name: /deposit to trade/i })
    expect(deposit).toBeInTheDocument()
    expect(deposit).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Place Order' })).not.toBeInTheDocument()
  })

  it('renders a disabled "Checking…" button while the first Snapshot is in flight', () => {
    renderGate(makePortfolio(null))
    const checking = screen.getByRole('button', { name: /checking/i })
    expect(checking).toBeDisabled()
    expect(checking).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('button', { name: 'Place Order' })).not.toBeInTheDocument()
  })

  it('renders children when the venue exposes no portfolio capability', () => {
    renderGate(undefined)
    expect(screen.getByRole('button', { name: 'Place Order' })).toBeInTheDocument()
  })

  // ADR-0027 D-3: Tradeable Funds is the *perp* account-value check. Under the
  // 'perps' scope the Snapshot's accountValue equals perp equity — a regression
  // to 'all' would fold in spot equity and break the spot-only edge case.
  it('subscribes at the perps scope', () => {
    let seenScope: PortfolioAccountScope | null = null
    const portfolio: PortfolioReader = {
      subscribeSnapshot: (scope, onUpdate) => {
        seenScope = scope
        onUpdate(buildSnapshot(100))
        return () => {}
      },
      getHistory: () => okAsync([]),
    }
    renderGate(portfolio)
    expect(seenScope).toBe('perps')
  })
})
