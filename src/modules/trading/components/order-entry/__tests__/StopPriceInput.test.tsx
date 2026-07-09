import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StopPriceInput } from '../StopPriceInput'

describe('StopPriceInput', () => {
  it('renders the Stop Price label', () => {
    render(
      <StopPriceInput value="" isValid midPrice={60_000} onChange={() => {}} onUseMid={() => {}} />,
    )
    expect(screen.getByLabelText('Stop Price')).toBeInTheDocument()
  })

  it('forwards typed input to onChange', async () => {
    const onChange = vi.fn()
    render(
      <StopPriceInput value="" isValid midPrice={60_000} onChange={onChange} onUseMid={() => {}} />,
    )
    await userEvent.type(screen.getByLabelText('Stop Price'), '6')
    expect(onChange).toHaveBeenCalledWith('6')
  })

  it('calls onUseMid when the MID chip is clicked', async () => {
    const onUseMid = vi.fn()
    render(
      <StopPriceInput value="" isValid midPrice={60_000} onChange={() => {}} onUseMid={onUseMid} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'MID' }))
    expect(onUseMid).toHaveBeenCalledTimes(1)
  })

  it('disables the MID chip when the mid is unknown', () => {
    render(<StopPriceInput value="" isValid midPrice={0} onChange={() => {}} onUseMid={() => {}} />)
    expect(screen.getByRole('button', { name: 'MID' })).toBeDisabled()
  })

  it('uses the decimal input mode for the numeric stop-price field', () => {
    render(
      <StopPriceInput value="" isValid midPrice={60_000} onChange={() => {}} onUseMid={() => {}} />,
    )
    expect(screen.getByLabelText('Stop Price')).toHaveAttribute('inputmode', 'decimal')
  })

  it('marks the field invalid when a non-empty value fails validation', () => {
    render(
      <StopPriceInput
        value="-1"
        isValid={false}
        midPrice={60_000}
        onChange={() => {}}
        onUseMid={() => {}}
      />,
    )
    expect(screen.getByLabelText('Stop Price')).toHaveAttribute('aria-invalid', 'true')
  })

  it('does not mark the field invalid while empty', () => {
    render(
      <StopPriceInput
        value=""
        isValid={false}
        midPrice={60_000}
        onChange={() => {}}
        onUseMid={() => {}}
      />,
    )
    expect(screen.getByLabelText('Stop Price')).toHaveAttribute('aria-invalid', 'false')
  })
})
