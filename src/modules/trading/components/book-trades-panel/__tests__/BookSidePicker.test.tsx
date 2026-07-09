import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BookSidePicker } from '../BookSidePicker'

describe('BookSidePicker', () => {
  it('renders both / bids / asks segments with the active side pressed', () => {
    render(<BookSidePicker value="bids" onChange={vi.fn()} />)
    expect(screen.getByRole('group', { name: 'Order book side' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show both sides', pressed: false })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show bids only', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show asks only', pressed: false })).toBeInTheDocument()
  })

  it('calls onChange with the picked side', async () => {
    const onChange = vi.fn()
    render(<BookSidePicker value="both" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Show asks only' }))
    expect(onChange).toHaveBeenCalledWith('asks')
  })

  it('does not fire onChange when the already-active side is clicked', async () => {
    const onChange = vi.fn()
    render(<BookSidePicker value="asks" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Show asks only' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
