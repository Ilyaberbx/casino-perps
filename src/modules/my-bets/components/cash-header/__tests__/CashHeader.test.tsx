import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CashHeader } from '../CashHeader'

function renderHeader(overrides: Partial<Parameters<typeof CashHeader>[0]> = {}) {
  const props = {
    cashLabel: '$1,240.55',
    isConnected: true,
    onAddCash: vi.fn(),
    onWithdraw: vi.fn(),
    ...overrides,
  }
  render(<CashHeader {...props} />)
  return props
}

describe('CashHeader', () => {
  it('shows the cash label and both actions when connected', () => {
    renderHeader()
    expect(screen.getByTestId('cash-amount')).toHaveTextContent('$1,240.55')
    expect(screen.getByRole('button', { name: 'Add Cash' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cash Out to Wallet' })).toBeInTheDocument()
  })

  it('hides the money-movement actions when disconnected', () => {
    renderHeader({ isConnected: false })
    expect(screen.queryByRole('button', { name: 'Add Cash' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cash Out to Wallet' })).not.toBeInTheDocument()
  })

  it('wires the action handlers', async () => {
    const props = renderHeader()
    await userEvent.click(screen.getByRole('button', { name: 'Add Cash' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cash Out to Wallet' }))
    expect(props.onAddCash).toHaveBeenCalledTimes(1)
    expect(props.onWithdraw).toHaveBeenCalledTimes(1)
  })
})
