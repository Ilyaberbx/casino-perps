import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AmountInput } from '../AmountInput'

describe('AmountInput', () => {
  it('forwards typed input to onChange', async () => {
    const onChange = vi.fn()
    render(<AmountInput label="Amount" value="" isValid onChange={onChange} />)

    await userEvent.type(screen.getByLabelText('Amount'), '5')

    expect(onChange).toHaveBeenCalledWith('5')
  })

  it('marks the field invalid and wires the reason via aria-describedby once typed', () => {
    render(
      <AmountInput
        label="Amount"
        value="3"
        isValid={false}
        invalidReason="Minimum deposit is 5 USDC"
        onChange={() => {}}
      />,
    )

    const input = screen.getByLabelText('Amount')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const reason = screen.getByText('Minimum deposit is 5 USDC')
    expect(input).toHaveAttribute('aria-describedby', reason.id)
  })

  it('renders a MAX affordance only when onMax is provided', async () => {
    const onMax = vi.fn()
    const { rerender } = render(
      <AmountInput label="Amount" value="10" isValid onChange={() => {}} />,
    )
    expect(screen.queryByRole('button', { name: /max/i })).not.toBeInTheDocument()

    rerender(<AmountInput label="Amount" value="10" isValid onChange={() => {}} onMax={onMax} />)
    await userEvent.click(screen.getByRole('button', { name: /max/i }))
    expect(onMax).toHaveBeenCalledOnce()
  })
})
