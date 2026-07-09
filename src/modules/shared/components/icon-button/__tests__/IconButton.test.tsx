import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { X } from 'lucide-react'
import { IconButton } from '../IconButton'

describe('IconButton', () => {
  it('exposes the ariaLabel as the accessible name and hides the glyph', () => {
    const { container } = render(<IconButton icon={X} ariaLabel="Close" />)
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('fires onClick when pressed', async () => {
    const onClick = vi.fn()
    render(<IconButton icon={X} ariaLabel="Close" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('defaults to type=button so it never submits a form', () => {
    render(<IconButton icon={X} ariaLabel="Close" />)
    expect(screen.getByRole('button', { name: 'Close' })).toHaveAttribute('type', 'button')
  })

  it('passes through aria-disabled and data attributes', () => {
    render(
      <IconButton icon={X} ariaLabel="Close" aria-disabled data-disabled-gate="true" tone="destructive" />,
    )
    const btn = screen.getByRole('button', { name: 'Close' })
    expect(btn).toHaveAttribute('aria-disabled', 'true')
    expect(btn).toHaveAttribute('data-disabled-gate', 'true')
  })
})
