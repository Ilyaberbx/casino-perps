import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createElement } from 'react'
import { WithdrawFlowContext } from '../../../providers/withdraw-flow-provider/withdraw-flow-provider.context'
import type { WithdrawFlowState } from '../../../providers/withdraw-flow-provider'
import { WithdrawFlow } from '../WithdrawFlow'
import { buildWithdrawFlowContext } from '../__fixtures__/build-withdraw-flow-state'

const OTHER = '0x2222222222222222222222222222222222222222'

function renderBody(overrides: Partial<WithdrawFlowState> = {}): void {
  const value = buildWithdrawFlowContext(overrides)
  render(createElement(WithdrawFlowContext.Provider, { value }, createElement(WithdrawFlow)))
}

describe('WithdrawFlow body — per phase', () => {
  it('renders the form with the title, available line, and fee/min summary', () => {
    renderBody({ phase: 'form', withdrawable: 80 })
    expect(screen.getByText('Withdraw to Arbitrum')).toBeInTheDocument()
    expect(screen.getByText(/Available to withdraw/i)).toBeInTheDocument()
    expect(screen.getByText('80 USDC')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Review withdrawal/i })).toBeInTheDocument()
  })

  it('shows the "your wallet" hint when the destination is unedited', () => {
    renderBody({ phase: 'form', isDestinationEdited: false })
    expect(screen.getByText('(your wallet)')).toBeInTheDocument()
  })

  it('renders the irreversible warning + confirm checkbox once the destination is edited', () => {
    renderBody({ phase: 'form', isDestinationEdited: true, destination: OTHER })
    expect(screen.getByText(/Withdrawals are irreversible/i)).toBeInTheDocument()
    expect(
      screen.getByText(/I understand this withdrawal is irreversible/i),
    ).toBeInTheDocument()
  })

  it('disables the review CTA until canReview is true', () => {
    renderBody({ phase: 'form', canReview: false })
    expect(screen.getByRole('button', { name: /Review withdrawal/i })).toBeDisabled()
  })

  it('enables the review CTA when canReview is true', () => {
    renderBody({ phase: 'form', canReview: true })
    expect(screen.getByRole('button', { name: /Review withdrawal/i })).toBeEnabled()
  })

  it('renders the review step with Back + Sign and a copyable destination', () => {
    renderBody({ phase: 'review', amount: '40', destination: OTHER })
    expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sign withdrawal/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Copy address')).toBeInTheDocument()
  })

  it('marks the sign button busy while signing', () => {
    renderBody({ phase: 'signing', amount: '40', destination: OTHER })
    const sign = screen.getByRole('button', { name: /Confirm in your wallet/i })
    expect(sign).toHaveAttribute('aria-busy', 'true')
  })

  it('renders the arrival track with a Done button on sent', () => {
    renderBody({ phase: 'sent' })
    expect(screen.getByText(/Withdrawal signed/i)).toBeInTheDocument()
    expect(screen.getByText(/Arriving on Arbitrum/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Done/i })).toBeInTheDocument()
  })

  it('renders the error callout + retry on error, preserving the two-step shell', () => {
    renderBody({ phase: 'error', errorReason: 'wallet-rejected' })
    expect(screen.getByText(/You declined the request/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument()
  })
})

describe('WithdrawFlow body — wiring', () => {
  it('fires review() from the CTA when enabled', async () => {
    const user = userEvent.setup()
    const value = buildWithdrawFlowContext({ phase: 'form', canReview: true })
    render(createElement(WithdrawFlowContext.Provider, { value }, createElement(WithdrawFlow)))
    await user.click(screen.getByRole('button', { name: /Review withdrawal/i }))
    expect(value.flow.review).toHaveBeenCalledOnce()
  })

  it('fires submit() from the Sign button in review', async () => {
    const user = userEvent.setup()
    const value = buildWithdrawFlowContext({ phase: 'review', amount: '40', destination: OTHER })
    render(createElement(WithdrawFlowContext.Provider, { value }, createElement(WithdrawFlow)))
    await user.click(screen.getByRole('button', { name: /Sign withdrawal/i }))
    expect(value.flow.submit).toHaveBeenCalledOnce()
  })

  it('fires reset() from Done on the arrival track', async () => {
    const user = userEvent.setup()
    const value = buildWithdrawFlowContext({ phase: 'sent' })
    render(createElement(WithdrawFlowContext.Provider, { value }, createElement(WithdrawFlow)))
    await user.click(screen.getByRole('button', { name: /Done/i }))
    expect(value.flow.reset).toHaveBeenCalledOnce()
  })
})
