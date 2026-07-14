import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OpenPositionsSection } from '../OpenPositionsSection'
import type { OpenPositionRow } from '../../../my-bets.types'

const POSITION: OpenPositionRow = {
  symbol: 'BTC-PERP',
  ticker: 'BTC',
  side: 'long',
  leverage: 10,
  pnlUsd: 124,
  isUp: true,
  liquidationPriceText: '94,102',
  isClosing: false,
}

describe('OpenPositionsSection', () => {
  it('renders an empty state when there are no positions', () => {
    render(<OpenPositionsSection positions={[]} onClose={vi.fn()} />)
    expect(screen.getByText('No open positions.')).toBeInTheDocument()
  })

  it('renders a position row with the PnL and the liquidation price as a number', () => {
    render(<OpenPositionsSection positions={[POSITION]} onClose={vi.fn()} />)
    expect(screen.getByText('BTC')).toBeInTheDocument()
    expect(screen.getByText('LONG 10x')).toBeInTheDocument()
    expect(screen.getByTestId('position-pnl')).toHaveTextContent('+$124.00')
    expect(screen.getByTestId('position-liquidation')).toHaveTextContent('$94,102')
  })

  it('renders a placeholder when the venue reports no liquidation price', () => {
    render(
      <OpenPositionsSection
        positions={[{ ...POSITION, liquidationPriceText: null }]}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByTestId('position-liquidation')).toHaveTextContent('--')
  })

  it('closes the position by symbol', async () => {
    const onClose = vi.fn()
    render(<OpenPositionsSection positions={[POSITION]} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledWith('BTC-PERP')
  })

  it('disables the button and shows progress while closing', () => {
    render(
      <OpenPositionsSection positions={[{ ...POSITION, isClosing: true }]} onClose={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Closing…' })).toBeDisabled()
  })
})
