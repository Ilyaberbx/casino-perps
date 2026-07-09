import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SheetAgentBalance } from '../SheetAgentBalance'
import {
  AGENT_BALANCE_LABEL,
  TOP_UP_LABEL,
} from '../perp-suggestion-sheet.constants'
import type { PersistentBalanceViewModel } from '../perp-suggestion-sheet.types'

function makeBalance(
  overrides: Partial<PersistentBalanceViewModel> = {},
): PersistentBalanceViewModel {
  return {
    display: '$42.00',
    isLoading: false,
    isError: false,
    showTopUp: false,
    scopedVenueId: 'hyperliquid',
    onTopUp: vi.fn(),
    ...overrides,
  }
}

describe('SheetAgentBalance', () => {
  it('renders the Agent Balance label + the reconciled display, scoped to the venue', () => {
    render(<SheetAgentBalance balance={makeBalance({ display: '$42.00' })} />)
    const panel = screen.getByTestId('sheet-agent-balance')
    expect(panel).toHaveTextContent(AGENT_BALANCE_LABEL)
    expect(screen.getByTestId('sheet-agent-balance-value')).toHaveTextContent(
      '$42.00',
    )
    expect(panel).toHaveAttribute('data-venue', 'hyperliquid')
  })

  it('shows a loading placeholder instead of the figure while the read is in flight', () => {
    render(<SheetAgentBalance balance={makeBalance({ isLoading: true })} />)
    expect(screen.getByTestId('sheet-agent-balance-loading')).toBeInTheDocument()
    expect(
      screen.queryByTestId('sheet-agent-balance-value'),
    ).not.toBeInTheDocument()
  })

  it('shows an explicit "Unavailable" (never the figure) when the live read failed', () => {
    render(<SheetAgentBalance balance={makeBalance({ isError: true, display: '$0.00' })} />)
    expect(screen.getByTestId('sheet-agent-balance-error')).toHaveTextContent('Unavailable')
    expect(
      screen.queryByTestId('sheet-agent-balance-value'),
    ).not.toBeInTheDocument()
  })

  it('hides the Top-Up affordance when the balance is sufficient', () => {
    render(<SheetAgentBalance balance={makeBalance({ showTopUp: false })} />)
    expect(
      screen.queryByRole('button', { name: TOP_UP_LABEL }),
    ).not.toBeInTheDocument()
  })

  it('shows the Top-Up affordance and routes clicks to onTopUp when insufficient', async () => {
    const user = userEvent.setup()
    const onTopUp = vi.fn()
    render(
      <SheetAgentBalance balance={makeBalance({ showTopUp: true, onTopUp })} />,
    )
    await user.click(screen.getByRole('button', { name: TOP_UP_LABEL }))
    expect(onTopUp).toHaveBeenCalledTimes(1)
  })
})
