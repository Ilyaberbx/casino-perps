import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { WithdrawFlowViewModel } from '../../../agent-balance.types'

const useWithdrawFlowMock = vi.fn<() => WithdrawFlowViewModel>()

vi.mock('../use-withdraw-flow', () => ({
  useWithdrawFlow: () => useWithdrawFlowMock(),
}))

vi.mock('@/modules/account', () => ({
  ConnectWalletGateButton: (props: { children: React.ReactNode }) => props.children,
}))

import { WithdrawFlow } from '../WithdrawFlow'

function baseVm(overrides: Partial<WithdrawFlowViewModel> = {}): WithdrawFlowViewModel {
  return {
    phase: 'editing',
    destination: '',
    isDestinationValid: false,
    isDestinationEdited: false,
    amount: '',
    isAmountValid: false,
    amountInvalidReason: null,
    withdrawable: 100,
    minWithdraw: 1,
    netReceived: 0,
    confirmedIrreversible: false,
    canSubmit: false,
    walletSuggestions: [],
    recentSuggestions: [],
    errorReason: null,
    transactionHash: null,
    setDestination: vi.fn(),
    setAmount: vi.fn(),
    setAmountToMax: vi.fn(),
    setPercent: vi.fn(),
    toggleConfirmIrreversible: vi.fn(),
    authorize: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  }
}

function deps() {
  return {
    availableUsdc: 100,
    getWithdrawAuthorizer: vi.fn() as never,
    walletSuggestions: [],
    recentSuggestions: [],
    onRecordRecipient: vi.fn(),
    switchToBase: vi.fn(),
  }
}

describe('WithdrawFlow', () => {
  beforeEach(() => useWithdrawFlowMock.mockReset())

  it('renders the shared amount input, percent chips, destination field and authorize CTA', () => {
    useWithdrawFlowMock.mockReturnValue(baseVm())
    render(<WithdrawFlow {...deps()} />)
    expect(screen.getByLabelText(/amount \(usdc\)/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '50%' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^max$/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/withdraw destination base address/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /authorize withdrawal/i })).toBeInTheDocument()
  })

  it('surfaces the available-to-withdraw line', () => {
    useWithdrawFlowMock.mockReturnValue(baseVm({ withdrawable: 42 }))
    render(<WithdrawFlow {...deps()} />)
    expect(screen.getByText(/available to withdraw/i)).toBeInTheDocument()
    expect(screen.getByText(/42 USDC/)).toBeInTheDocument()
  })

  it('shows the irreversible warning + confirm checkbox once a destination is entered', () => {
    useWithdrawFlowMock.mockReturnValue(
      baseVm({ destination: '0xabc', isDestinationEdited: true }),
    )
    render(<WithdrawFlow {...deps()} />)
    expect(screen.getByText(/withdrawals are irreversible/i)).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: /i understand this withdrawal is irreversible/i }),
    ).toBeInTheDocument()
  })

  it('disables the authorize button until the hook reports canSubmit', () => {
    useWithdrawFlowMock.mockReturnValue(baseVm({ canSubmit: false }))
    render(<WithdrawFlow {...deps()} />)
    expect(screen.getByRole('button', { name: /authorize withdrawal/i })).toBeDisabled()
  })

  it('enables the authorize button when canSubmit is true', () => {
    useWithdrawFlowMock.mockReturnValue(
      baseVm({
        canSubmit: true,
        isDestinationValid: true,
        isDestinationEdited: true,
        isAmountValid: true,
        confirmedIrreversible: true,
      }),
    )
    render(<WithdrawFlow {...deps()} />)
    expect(screen.getByRole('button', { name: /authorize withdrawal/i })).toBeEnabled()
  })

  it('surfaces the explicit-approval pending label while authorizing', () => {
    useWithdrawFlowMock.mockReturnValue(baseVm({ phase: 'authorizing' }))
    render(<WithdrawFlow {...deps()} />)
    expect(screen.getByRole('button', { name: /awaiting approval/i })).toBeInTheDocument()
  })

  it('renders an inline error callout with a retry', () => {
    useWithdrawFlowMock.mockReturnValue(
      baseVm({ phase: 'error', errorReason: 'transfer-failed' }),
    )
    render(<WithdrawFlow {...deps()} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't send the withdrawal/i)
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('renders distinct, actionable copy for insufficient-gas', () => {
    useWithdrawFlowMock.mockReturnValue(
      baseVm({ phase: 'error', errorReason: 'insufficient-gas' }),
    )
    render(<WithdrawFlow {...deps()} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/enough eth on base/i)
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('renders distinct, actionable copy for insufficient-balance', () => {
    useWithdrawFlowMock.mockReturnValue(
      baseVm({ phase: 'error', errorReason: 'insufficient-balance' }),
    )
    render(<WithdrawFlow {...deps()} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/usdc balance is too low/i)
  })

  it('renders an actionable "Switch to Base" CTA for wrong-network instead of a no-op retry', () => {
    useWithdrawFlowMock.mockReturnValue(
      baseVm({ phase: 'error', errorReason: 'wrong-network' }),
    )
    render(<WithdrawFlow {...deps()} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/switch your wallet to base/i)
    expect(screen.getByRole('button', { name: /switch to base/i })).toBeInTheDocument()
  })

  it('renders a calm, non-alarming status callout for receipt-timeout, not an error', () => {
    useWithdrawFlowMock.mockReturnValue(
      baseVm({ phase: 'error', errorReason: 'receipt-timeout' }),
    )
    render(<WithdrawFlow {...deps()} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/taking longer than usual/i)
    // "Try again" would wrongly imply resubmitting a transfer that already broadcast.
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^okay$/i })).toBeInTheDocument()
  })

  it('renders the sent confirmation', () => {
    useWithdrawFlowMock.mockReturnValue(baseVm({ phase: 'sent' }))
    render(<WithdrawFlow {...deps()} />)
    expect(screen.getByRole('status')).toHaveTextContent(/sent/i)
  })
})
