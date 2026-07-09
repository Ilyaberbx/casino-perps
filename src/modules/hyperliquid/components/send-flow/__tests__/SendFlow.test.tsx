import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createElement } from 'react'
import { SendFlowContext } from '../../../providers/send-flow-provider/send-flow-provider.context'
import type { SendFlowState } from '../../../providers/send-flow-provider'
import { SendFlow } from '../SendFlow'
import { buildSendFlowContext } from '../__fixtures__/build-send-flow-state'

const OTHER = '0x2222222222222222222222222222222222222222'

function renderBody(overrides: Partial<SendFlowState> = {}): void {
  const value = buildSendFlowContext(overrides)
  render(createElement(SendFlowContext.Provider, { value }, createElement(SendFlow)))
}

describe('SendFlow body — per phase', () => {
  it('renders the form with the title, token picker, and available line', () => {
    renderBody({ phase: 'form', symbol: 'USDC', available: 80 })
    expect(screen.getByRole('heading', { name: 'Send' })).toBeInTheDocument()
    expect(screen.getByLabelText('Asset')).toBeInTheDocument()
    expect(screen.getByText('80 USDC')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Review send/i })).toBeInTheDocument()
  })

  it('lists every sendable token in the picker', async () => {
    const user = userEvent.setup()
    renderBody({ phase: 'form' })
    await user.click(screen.getByRole('button', { name: /Asset/ }))
    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual([
      'USDC · 100 available',
      'HYPE · 50 available',
    ])
  })

  it('shows the stays-on-Hyperliquid note (no $1 fee line)', () => {
    renderBody({ phase: 'form' })
    expect(screen.getByText(/Stays on Hyperliquid/i)).toBeInTheDocument()
    expect(screen.queryByText(/\$1/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Fee/i)).not.toBeInTheDocument()
  })

  it('surfaces the self-send guard reason at the recipient field', () => {
    renderBody({
      phase: 'form',
      destination: '0x1111111111111111111111111111111111111111',
      isDestinationValid: false,
      destinationInvalidReason: "That's your own address. Enter a different recipient.",
    })
    expect(screen.getByText(/your own address/i)).toBeInTheDocument()
  })

  it('disables the review CTA until canReview is true', () => {
    renderBody({ phase: 'form', canReview: false })
    expect(screen.getByRole('button', { name: /Review send/i })).toBeDisabled()
  })

  it('enables the review CTA when canReview is true', () => {
    renderBody({ phase: 'form', canReview: true })
    expect(screen.getByRole('button', { name: /Review send/i })).toBeEnabled()
  })

  it('renders the review step with Back + Sign and a copyable recipient', () => {
    renderBody({ phase: 'review', amount: '40', symbol: 'USDC', destination: OTHER })
    expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sign send/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Copy address')).toBeInTheDocument()
  })

  it('marks the sign button busy while signing', () => {
    renderBody({ phase: 'signing', amount: '40', destination: OTHER })
    const sign = screen.getByRole('button', { name: /Confirm in your wallet/i })
    expect(sign).toHaveAttribute('aria-busy', 'true')
  })

  it('renders the instant success confirmation with a Done button on sent', () => {
    renderBody({ phase: 'sent', amount: '40', symbol: 'USDC' })
    expect(screen.getByText(/Sent 40 USDC/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Done/i })).toBeInTheDocument()
  })

  it('renders the error callout + retry on error', () => {
    renderBody({ phase: 'error', errorReason: 'wallet-rejected' })
    expect(screen.getByText(/You declined the request/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument()
  })
})

const WALLET_SUGGESTION = {
  address: '0x3333333333333333333333333333333333333333',
  title: 'Native',
  subtitle: '0x3333…3333',
}

describe('SendFlow body — recipient combobox', () => {
  it('opens grouped recipient suggestions on focus', async () => {
    const user = userEvent.setup()
    const value = buildSendFlowContext({ phase: 'form', walletSuggestions: [WALLET_SUGGESTION] })
    render(createElement(SendFlowContext.Provider, { value }, createElement(SendFlow)))
    await user.click(screen.getByRole('combobox', { name: 'Recipient address' }))
    expect(screen.getByRole('listbox', { name: 'Recipient suggestions' })).toBeInTheDocument()
    expect(screen.getByText('Your wallets')).toBeInTheDocument()
    expect(screen.getByRole('option')).toBeInTheDocument()
  })

  it('writes the selected suggestion into the recipient field', async () => {
    const user = userEvent.setup()
    const value = buildSendFlowContext({ phase: 'form', walletSuggestions: [WALLET_SUGGESTION] })
    render(createElement(SendFlowContext.Provider, { value }, createElement(SendFlow)))
    await user.click(screen.getByRole('combobox', { name: 'Recipient address' }))
    await user.click(screen.getByRole('option'))
    expect(value.flow.setDestination).toHaveBeenCalledWith(WALLET_SUGGESTION.address)
  })

  it('shows no suggestion caret when there are no suggestions', () => {
    renderBody({ phase: 'form' })
    expect(screen.queryByRole('button', { name: /Show recipient suggestions/i })).not.toBeInTheDocument()
  })
})

describe('SendFlow body — wiring', () => {
  it('fires selectToken() when the picker changes', async () => {
    const user = userEvent.setup()
    const value = buildSendFlowContext({ phase: 'form' })
    render(createElement(SendFlowContext.Provider, { value }, createElement(SendFlow)))
    await user.click(screen.getByRole('button', { name: /Asset/ }))
    await user.click(screen.getByRole('option', { name: /HYPE/ }))
    expect(value.flow.selectToken).toHaveBeenCalledWith('spot:HYPE')
  })

  it('fires review() from the CTA when enabled', async () => {
    const user = userEvent.setup()
    const value = buildSendFlowContext({ phase: 'form', canReview: true })
    render(createElement(SendFlowContext.Provider, { value }, createElement(SendFlow)))
    await user.click(screen.getByRole('button', { name: /Review send/i }))
    expect(value.flow.review).toHaveBeenCalledOnce()
  })

  it('fires submit() from the Sign button in review', async () => {
    const user = userEvent.setup()
    const value = buildSendFlowContext({ phase: 'review', amount: '40', destination: OTHER })
    render(createElement(SendFlowContext.Provider, { value }, createElement(SendFlow)))
    await user.click(screen.getByRole('button', { name: /Sign send/i }))
    expect(value.flow.submit).toHaveBeenCalledOnce()
  })

  it('fires reset() from Done on the success confirmation', async () => {
    const user = userEvent.setup()
    const value = buildSendFlowContext({ phase: 'sent', amount: '40', symbol: 'USDC' })
    render(createElement(SendFlowContext.Provider, { value }, createElement(SendFlow)))
    await user.click(screen.getByRole('button', { name: /Done/i }))
    expect(value.flow.reset).toHaveBeenCalledOnce()
  })
})
