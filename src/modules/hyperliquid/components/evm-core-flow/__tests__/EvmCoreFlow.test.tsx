import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createElement } from 'react'
import { EvmCoreFlowContext } from '../../../providers/evm-core-flow-provider/evm-core-flow-provider.context'
import type { EvmCoreFlowState } from '../../../providers/evm-core-flow-provider'
import { EvmCoreFlow } from '../EvmCoreFlow'
import { buildEvmCoreFlowContext } from '../__fixtures__/build-evm-core-flow-state'

function renderBody(overrides: Partial<EvmCoreFlowState> = {}): void {
  const value = buildEvmCoreFlowContext(overrides)
  render(createElement(EvmCoreFlowContext.Provider, { value }, createElement(EvmCoreFlow)))
}

describe('EvmCoreFlow body — per phase', () => {
  it('renders the form with the title, direction toggle, token picker, and available line', () => {
    renderBody({ phase: 'form', symbol: 'BTC', available: 2 })
    expect(screen.getByRole('heading', { name: 'EVM⇄Core' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Direction' })).toBeInTheDocument()
    expect(screen.getByLabelText('Asset')).toBeInTheDocument()
    expect(screen.getByText('2 BTC')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Review transfer/i })).toBeInTheDocument()
  })

  it('offers both directions live and marks the active one pressed', () => {
    renderBody({ phase: 'form', direction: 'core-to-evm' })
    const coreToEvm = screen.getByRole('button', { name: /Core → EVM/i })
    const evmToCore = screen.getByRole('button', { name: /EVM → Core/i })
    expect(coreToEvm).toHaveAttribute('aria-pressed', 'true')
    expect(evmToCore).toBeEnabled()
  })

  it('gates the EVM→Core form behind a no-gas callout when preflight is no-gas', () => {
    renderBody({ phase: 'form', direction: 'evm-to-core', evmPreflight: 'no-gas' })
    expect(screen.getByText(/HYPE on HyperEVM/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Review transfer/i })).not.toBeInTheDocument()
  })

  it('offers a switch-chain affordance when preflight is wrong-chain', () => {
    renderBody({ phase: 'form', direction: 'evm-to-core', evmPreflight: 'wrong-chain' })
    expect(screen.getByRole('button', { name: /Switch to HyperEVM/i })).toBeInTheDocument()
  })

  it('shows an explorer link on the EVM→Core success state', () => {
    renderBody({
      phase: 'sent',
      direction: 'evm-to-core',
      amount: '1',
      symbol: 'BTC',
      transactionHash: '0xabc',
      explorerTxUrl: 'https://purrsec.com/tx/0xabc',
    })
    expect(screen.getByText(/Moved 1 BTC to HyperCore/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View transaction/i })).toHaveAttribute(
      'href',
      'https://purrsec.com/tx/0xabc',
    )
  })

  it('lists every movable token in the picker', async () => {
    const user = userEvent.setup()
    renderBody({ phase: 'form' })
    await user.click(screen.getByRole('button', { name: /Asset/ }))
    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual([
      'BTC · 2 available',
      'HYPE · 50 available',
    ])
  })

  it('shows the credited-to-your-HyperEVM-address note (no recipient field)', () => {
    renderBody({ phase: 'form' })
    expect(screen.getByText('Your HyperEVM address')).toBeInTheDocument()
    expect(screen.getByText('Credited to your HyperEVM address')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Recipient/i)).not.toBeInTheDocument()
  })

  it('disables the review CTA until canReview is true', () => {
    renderBody({ phase: 'form', canReview: false })
    expect(screen.getByRole('button', { name: /Review transfer/i })).toBeDisabled()
  })

  it('renders the review step with Back + Sign', () => {
    renderBody({ phase: 'review', amount: '1', symbol: 'BTC' })
    expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sign transfer/i })).toBeInTheDocument()
  })

  it('marks the sign button busy while signing', () => {
    renderBody({ phase: 'signing', amount: '1' })
    const sign = screen.getByRole('button', { name: /Confirm in your wallet/i })
    expect(sign).toHaveAttribute('aria-busy', 'true')
  })

  it('renders the instant success confirmation with a Done button on sent', () => {
    renderBody({ phase: 'sent', amount: '1', symbol: 'BTC' })
    expect(screen.getByText(/Moved 1 BTC to HyperEVM/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Done/i })).toBeInTheDocument()
  })

  it('renders the error callout + retry on error', () => {
    renderBody({ phase: 'error', errorReason: 'wallet-rejected' })
    expect(screen.getByText(/You declined the request/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument()
  })
})

describe('EvmCoreFlow body — wiring', () => {
  it('fires review() from the CTA when enabled', async () => {
    const user = userEvent.setup()
    const value = buildEvmCoreFlowContext({ phase: 'form', canReview: true })
    render(createElement(EvmCoreFlowContext.Provider, { value }, createElement(EvmCoreFlow)))
    await user.click(screen.getByRole('button', { name: /Review transfer/i }))
    expect(value.flow.review).toHaveBeenCalledOnce()
  })

  it('fires submit() from the Sign button in review', async () => {
    const user = userEvent.setup()
    const value = buildEvmCoreFlowContext({ phase: 'review', amount: '1' })
    render(createElement(EvmCoreFlowContext.Provider, { value }, createElement(EvmCoreFlow)))
    await user.click(screen.getByRole('button', { name: /Sign transfer/i }))
    expect(value.flow.submit).toHaveBeenCalledOnce()
  })

  it('fires reset() from Done on the success confirmation', async () => {
    const user = userEvent.setup()
    const value = buildEvmCoreFlowContext({ phase: 'sent', amount: '1', symbol: 'BTC' })
    render(createElement(EvmCoreFlowContext.Provider, { value }, createElement(EvmCoreFlow)))
    await user.click(screen.getByRole('button', { name: /Done/i }))
    expect(value.flow.reset).toHaveBeenCalledOnce()
  })
})
