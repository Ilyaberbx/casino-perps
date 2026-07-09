import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import type { AgentBalanceActionsViewModel } from '../agent-balance-actions.types'

const useAgentBalanceActionsMock = vi.fn<() => AgentBalanceActionsViewModel>()

vi.mock('../use-agent-balance-actions', () => ({
  useAgentBalanceActions: () => useAgentBalanceActionsMock(),
}))

// `ConnectWalletGateButton` renders children only when connected; stub it to
// render children so the affordances are assertable without Privy.
vi.mock('@/modules/account', () => ({
  ConnectWalletGateButton: (props: { children: ReactNode }) => props.children,
}))

import { AgentBalanceActions } from '../AgentBalanceActions'

function baseVm(
  overrides: Partial<AgentBalanceActionsViewModel> = {},
): AgentBalanceActionsViewModel {
  return {
    isSimple: false,
    openDeposit: vi.fn(),
    openWithdraw: vi.fn(),
    openDelegation: vi.fn(),
    ...overrides,
  }
}

describe('AgentBalanceActions', () => {
  beforeEach(() => useAgentBalanceActionsMock.mockReset())

  it('renders the Deposit and Withdraw triggers', () => {
    useAgentBalanceActionsMock.mockReturnValue(baseVm())
    render(<AgentBalanceActions />)
    expect(screen.getByRole('button', { name: /deposit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /withdraw/i })).toBeInTheDocument()
  })

  it('opens the deposit flow on the Deposit click', async () => {
    const openDeposit = vi.fn()
    useAgentBalanceActionsMock.mockReturnValue(baseVm({ openDeposit }))
    render(<AgentBalanceActions />)
    await userEvent.click(screen.getByRole('button', { name: /deposit/i }))
    expect(openDeposit).toHaveBeenCalledTimes(1)
  })

  it('opens the withdraw flow on the Withdraw click', async () => {
    const openWithdraw = vi.fn()
    useAgentBalanceActionsMock.mockReturnValue(baseVm({ openWithdraw }))
    render(<AgentBalanceActions />)
    await userEvent.click(screen.getByRole('button', { name: /withdraw/i }))
    expect(openWithdraw).toHaveBeenCalledTimes(1)
  })

  it('opens the delegation-consent flow on the Signing click', async () => {
    const openDelegation = vi.fn()
    useAgentBalanceActionsMock.mockReturnValue(baseVm({ openDelegation }))
    render(<AgentBalanceActions />)
    await userEvent.click(screen.getByRole('button', { name: /signing/i }))
    expect(openDelegation).toHaveBeenCalledTimes(1)
  })

  it('Simple mode collapses to a single Manage Agent Wallet button (#273)', async () => {
    const openDeposit = vi.fn()
    useAgentBalanceActionsMock.mockReturnValue(baseVm({ isSimple: true, openDeposit }))
    render(<AgentBalanceActions />)
    expect(
      screen.getByRole('button', { name: /manage agent wallet/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^withdraw$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^signing$/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /manage agent wallet/i }))
    expect(openDeposit).toHaveBeenCalledTimes(1)
  })
})
