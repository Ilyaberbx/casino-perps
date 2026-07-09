import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FlowPercentChips } from '../FlowPercentChips'

const styles = { chips: 'chips', chip: 'chip' }
const CHIPS = [25, 50, 75, 100] as const

describe('FlowPercentChips', () => {
  it('renders one chip per value with a percent label', () => {
    render(<FlowPercentChips styles={styles} chips={CHIPS} disabled={false} onPercent={vi.fn()} />)
    expect(screen.getByRole('button', { name: '25%' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '50%' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '75%' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '100%' })).toBeInTheDocument()
  })

  it('fires onPercent with the chip value when clicked', async () => {
    const user = userEvent.setup()
    const onPercent = vi.fn()
    render(<FlowPercentChips styles={styles} chips={CHIPS} disabled={false} onPercent={onPercent} />)
    await user.click(screen.getByRole('button', { name: '75%' }))
    expect(onPercent).toHaveBeenCalledWith(75)
  })

  it('disables every chip when disabled is true', () => {
    render(<FlowPercentChips styles={styles} chips={CHIPS} disabled onPercent={vi.fn()} />)
    for (const chip of screen.getAllByRole('button')) {
      expect(chip).toBeDisabled()
    }
  })
})
