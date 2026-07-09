import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SizeInput } from '../SizeInput'

function renderSizeInput(overrides: Partial<Parameters<typeof SizeInput>[0]> = {}) {
  const props = {
    value: '',
    unit: 'coin' as const,
    isValid: true,
    baseAsset: 'ETH',
    quoteLabel: 'USDC',
    fraction: 0,
    onChange: () => {},
    onUnitChange: () => {},
    onFractionChange: () => {},
    ...overrides,
  }
  render(<SizeInput {...props} />)
  return props
}

describe('SizeInput', () => {
  it('renders the base asset and the USDC quote label as the unit toggle options', () => {
    renderSizeInput({ baseAsset: 'ETH', quoteLabel: 'USDC' })
    expect(screen.getByRole('button', { name: 'ETH' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'USDC' })).toBeInTheDocument()
  })

  it('marks the coin option pressed while the active unit is coin', () => {
    renderSizeInput({ baseAsset: 'ETH', quoteLabel: 'USDC', unit: 'coin' })
    expect(screen.getByRole('button', { name: 'ETH' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'USDC' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches to the usd unit when the USDC option is clicked', async () => {
    const onUnitChange = vi.fn()
    renderSizeInput({ quoteLabel: 'USDC', unit: 'coin', onUnitChange })
    await userEvent.click(screen.getByRole('button', { name: 'USDC' }))
    expect(onUnitChange).toHaveBeenCalledWith('usd')
  })

  it('switches back to the coin unit when the base-asset option is clicked', async () => {
    const onUnitChange = vi.fn()
    renderSizeInput({ baseAsset: 'ETH', unit: 'usd', onUnitChange })
    await userEvent.click(screen.getByRole('button', { name: 'ETH' }))
    expect(onUnitChange).toHaveBeenCalledWith('coin')
  })

  it('sets the full fraction when MAX is clicked', async () => {
    const onFractionChange = vi.fn()
    renderSizeInput({ onFractionChange })
    await userEvent.click(screen.getByRole('button', { name: 'MAX' }))
    expect(onFractionChange).toHaveBeenCalledWith(1)
  })

  it('uses the decimal input mode for the amount field', () => {
    renderSizeInput()
    expect(screen.getByLabelText('Order size')).toHaveAttribute('inputmode', 'decimal')
  })

  it('reports the slider position as a 0–1 fraction', () => {
    const onFractionChange = vi.fn()
    renderSizeInput({ onFractionChange })
    const slider = screen.getByRole('slider', { name: 'Percent of buying power' })
    fireEvent.change(slider, { target: { value: '50' } })
    expect(onFractionChange).toHaveBeenCalledWith(0.5)
  })
})
