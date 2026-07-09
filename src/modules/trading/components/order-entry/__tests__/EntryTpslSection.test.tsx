import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EntryTpslSection } from '../EntryTpslSection'
import type { EntryProtectionDraft } from '../order-entry.types'

const OFF_DRAFT: EntryProtectionDraft = {
  enabled: false,
  basis: 'usd',
  takeProfit: { priceInput: '', amountInput: '' },
  stopLoss: { priceInput: '', amountInput: '' },
}

const ON_DRAFT: EntryProtectionDraft = { ...OFF_DRAFT, enabled: true }

const NOOP_PROPS = {
  onEnabledChange: () => {},
  onBasisChange: () => {},
  onLegPriceChange: () => {},
  onLegAmountChange: () => {},
}

describe('EntryTpslSection', () => {
  it('hides the leg fields and the basis toggle when the section is off', () => {
    render(<EntryTpslSection protection={OFF_DRAFT} {...NOOP_PROPS} />)
    expect(screen.getByText('Take profit / Stop loss')).toBeInTheDocument()
    expect(screen.queryByLabelText('TP Price')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gain/loss in percent' })).not.toBeInTheDocument()
  })

  it('enables the section via its checkbox', async () => {
    const user = userEvent.setup()
    const onEnabledChange = vi.fn()
    render(
      <EntryTpslSection protection={OFF_DRAFT} {...NOOP_PROPS} onEnabledChange={onEnabledChange} />,
    )
    await user.click(screen.getByLabelText('Take profit / Stop loss'))
    expect(onEnabledChange).toHaveBeenCalledWith(true)
  })

  it('shows the 2×2 price + gain/loss grid when enabled', () => {
    render(<EntryTpslSection protection={ON_DRAFT} {...NOOP_PROPS} />)
    expect(screen.getByLabelText('TP Price')).toBeInTheDocument()
    expect(screen.getByLabelText('SL Price')).toBeInTheDocument()
    expect(screen.getByLabelText('Gain amount')).toBeInTheDocument()
    expect(screen.getByLabelText('Loss amount')).toBeInTheDocument()
  })

  it('switches the gain/loss basis from the header toggle', async () => {
    const user = userEvent.setup()
    const onBasisChange = vi.fn()
    render(<EntryTpslSection protection={ON_DRAFT} {...NOOP_PROPS} onBasisChange={onBasisChange} />)
    await user.click(screen.getByRole('button', { name: 'Gain/loss in percent' }))
    expect(onBasisChange).toHaveBeenCalledWith('percent')
  })

  it('exposes the gain/loss basis toggle state via aria-pressed and aria-label', () => {
    render(<EntryTpslSection protection={ON_DRAFT} {...NOOP_PROPS} />)
    const usdToggle = screen.getByRole('button', { name: 'Gain/loss in USD' })
    const percentToggle = screen.getByRole('button', { name: 'Gain/loss in percent' })
    expect(usdToggle).toHaveAttribute('aria-pressed', 'true')
    expect(percentToggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('relabels the gain/loss inputs as percent under the % basis', () => {
    render(<EntryTpslSection protection={{ ...ON_DRAFT, basis: 'percent' }} {...NOOP_PROPS} />)
    expect(screen.getByLabelText('Gain percent')).toBeInTheDocument()
    expect(screen.getByLabelText('Loss percent')).toBeInTheDocument()
  })

  it('uses the decimal input mode on every TP/SL numeric field', () => {
    render(<EntryTpslSection protection={ON_DRAFT} {...NOOP_PROPS} />)
    expect(screen.getByLabelText('TP Price')).toHaveAttribute('inputmode', 'decimal')
    expect(screen.getByLabelText('SL Price')).toHaveAttribute('inputmode', 'decimal')
    expect(screen.getByLabelText('Gain amount')).toHaveAttribute('inputmode', 'decimal')
    expect(screen.getByLabelText('Loss amount')).toHaveAttribute('inputmode', 'decimal')
  })

  it('forwards a typed price for the targeted leg', async () => {
    const user = userEvent.setup()
    const onLegPriceChange = vi.fn()
    render(
      <EntryTpslSection
        protection={ON_DRAFT}
        {...NOOP_PROPS}
        onLegPriceChange={onLegPriceChange}
      />,
    )
    await user.type(screen.getByLabelText('TP Price'), '7')
    expect(onLegPriceChange).toHaveBeenCalledWith('takeProfit', '7')
  })

  it('forwards a typed gain for the targeted leg', async () => {
    const user = userEvent.setup()
    const onLegAmountChange = vi.fn()
    render(
      <EntryTpslSection
        protection={ON_DRAFT}
        {...NOOP_PROPS}
        onLegAmountChange={onLegAmountChange}
      />,
    )
    await user.type(screen.getByLabelText('Loss amount'), '5')
    expect(onLegAmountChange).toHaveBeenCalledWith('stopLoss', '5')
  })
})
