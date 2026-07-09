import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PriceInput } from '../PriceInput'

describe('PriceInput', () => {
  it('renders the provided label', () => {
    render(
      <PriceInput
        label="Limit price"
        value=""
        isValid
        isDisabled={false}
        midPrice={60_000}
        onChange={() => {}}
        onUseMid={() => {}}
      />,
    )
    expect(screen.getByLabelText('Limit price')).toBeInTheDocument()
  })

  it('calls onUseMid when the MID chip is clicked', async () => {
    const onUseMid = vi.fn()
    render(
      <PriceInput
        label="Limit price"
        value=""
        isValid
        isDisabled={false}
        midPrice={60_000}
        onChange={() => {}}
        onUseMid={onUseMid}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'MID' }))
    expect(onUseMid).toHaveBeenCalledTimes(1)
  })

  it('disables the MID chip when the mid is unknown', () => {
    render(
      <PriceInput
        label="Limit price"
        value=""
        isValid
        isDisabled={false}
        midPrice={0}
        onChange={() => {}}
        onUseMid={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'MID' })).toBeDisabled()
  })

  it('uses the decimal input mode for the numeric price field', () => {
    render(
      <PriceInput
        label="Limit price"
        value=""
        isValid
        isDisabled={false}
        midPrice={60_000}
        onChange={() => {}}
        onUseMid={() => {}}
      />,
    )
    expect(screen.getByLabelText('Limit price')).toHaveAttribute('inputmode', 'decimal')
  })

  it('disables the field and the MID chip when isDisabled', () => {
    render(
      <PriceInput
        label="Limit price"
        value=""
        isValid
        isDisabled
        midPrice={60_000}
        onChange={() => {}}
        onUseMid={() => {}}
      />,
    )
    expect(screen.getByLabelText('Limit price')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'MID' })).toBeDisabled()
  })
})
