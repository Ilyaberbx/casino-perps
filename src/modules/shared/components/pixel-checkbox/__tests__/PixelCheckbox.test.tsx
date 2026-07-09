import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PixelCheckbox } from '../PixelCheckbox'

describe('PixelCheckbox', () => {
  it('associates the visible label so it is the accessible name', () => {
    render(<PixelCheckbox checked={false} onChange={() => {}} label="Reduce Only" />)
    expect(screen.getByRole('checkbox', { name: 'Reduce Only' })).toBeInTheDocument()
  })

  it('reflects the checked state', () => {
    render(<PixelCheckbox checked onChange={() => {}} label="Reduce Only" />)
    expect(screen.getByRole('checkbox', { name: 'Reduce Only' })).toBeChecked()
  })

  it('fires onChange with the next value when the label is clicked', async () => {
    const onChange = vi.fn()
    render(<PixelCheckbox checked={false} onChange={onChange} label="Reduce Only" />)
    await userEvent.click(screen.getByText('Reduce Only'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('toggles via keyboard (focus + Space)', async () => {
    const onChange = vi.fn()
    render(<PixelCheckbox checked={false} onChange={onChange} label="Randomize" />)
    const box = screen.getByRole('checkbox', { name: 'Randomize' })
    box.focus()
    expect(box).toHaveFocus()
    await userEvent.keyboard(' ')
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('uses ariaLabel as the accessible name when there is no visible label', () => {
    render(<PixelCheckbox checked={false} onChange={() => {}} ariaLabel="Select TWAP BTC" />)
    expect(screen.getByRole('checkbox', { name: 'Select TWAP BTC' })).toBeInTheDocument()
  })

  it('does not fire onChange when disabled', async () => {
    const onChange = vi.fn()
    render(<PixelCheckbox checked={false} onChange={onChange} label="Reduce Only" disabled />)
    const box = screen.getByRole('checkbox', { name: 'Reduce Only' })
    expect(box).toBeDisabled()
    await userEvent.click(box)
    expect(onChange).not.toHaveBeenCalled()
  })
})
