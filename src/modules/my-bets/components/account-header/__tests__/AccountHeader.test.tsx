import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountHeader } from '../AccountHeader'

function renderHeader(overrides: Partial<Parameters<typeof AccountHeader>[0]> = {}) {
  const props = {
    equityLabel: '$1,240.55',
    isConnected: true,
    onDeposit: vi.fn(),
    onWithdraw: vi.fn(),
    ...overrides,
  }
  render(<AccountHeader {...props} />)
  return props
}

describe('AccountHeader', () => {
  it('shows the account equity and both actions when connected', () => {
    renderHeader()
    expect(screen.getByTestId('account-equity')).toHaveTextContent('$1,240.55')
    expect(screen.getByRole('button', { name: 'Deposit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeInTheDocument()
  })

  it('hides the money-movement actions when disconnected', () => {
    renderHeader({ isConnected: false })
    expect(screen.queryByRole('button', { name: 'Deposit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument()
  })

  it('wires the action handlers', async () => {
    const props = renderHeader()
    await userEvent.click(screen.getByRole('button', { name: 'Deposit' }))
    await userEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    expect(props.onDeposit).toHaveBeenCalledTimes(1)
    expect(props.onWithdraw).toHaveBeenCalledTimes(1)
  })
})
