import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from '../Modal'

describe('Modal', () => {
  it('does not render anything when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={() => {}} ariaLabel="Test">
        <p>hidden content</p>
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('hidden content')).toBeNull()
  })

  it('renders dialog content when isOpen is true', () => {
    render(
      <Modal isOpen onClose={() => {}} ariaLabel="Test">
        <p>visible content</p>
      </Modal>,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('visible content')).toBeInTheDocument()
  })

  it('exposes ariaLabel as aria-label on the dialog', () => {
    render(
      <Modal isOpen onClose={() => {}} ariaLabel="Volume History">
        <p>body</p>
      </Modal>,
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Volume History')
  })

  it('calls onClose when ESC is pressed', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} ariaLabel="Test">
        <p>body</p>
      </Modal>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} ariaLabel="Test">
        <p>body</p>
      </Modal>,
    )
    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} ariaLabel="Test">
        <p>body</p>
      </Modal>,
    )
    await user.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onClose when clicking inside the dialog content', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} ariaLabel="Test">
        <p data-testid="inner">body</p>
      </Modal>,
    )
    await user.click(screen.getByTestId('inner'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('renders heading when title prop is provided', () => {
    render(
      <Modal isOpen onClose={() => {}} ariaLabel="Test" title="Your Volume History">
        <p>body</p>
      </Modal>,
    )
    expect(screen.getByRole('heading', { name: 'Your Volume History' })).toBeInTheDocument()
  })

  it('suppresses the built-in close button when hideClose is set', () => {
    render(
      <Modal isOpen onClose={() => {}} ariaLabel="Test" hideClose>
        <p>body</p>
      </Modal>,
    )
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  })

  it('suppresses the close button next to the title when hideClose is set', () => {
    render(
      <Modal isOpen onClose={() => {}} ariaLabel="Test" title="Heading" hideClose>
        <p>body</p>
      </Modal>,
    )
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  })

  it('unmounts content when closed by default (keepMounted off)', () => {
    const { rerender } = render(
      <Modal isOpen onClose={() => {}} ariaLabel="Test">
        <p>kept content</p>
      </Modal>,
    )
    expect(screen.getByText('kept content')).toBeInTheDocument()
    rerender(
      <Modal isOpen={false} onClose={() => {}} ariaLabel="Test">
        <p>kept content</p>
      </Modal>,
    )
    expect(screen.queryByText('kept content')).toBeNull()
  })

  it('keeps content mounted but hidden + inert when closed with keepMounted', () => {
    const { rerender } = render(
      <Modal isOpen onClose={() => {}} ariaLabel="Test" keepMounted>
        <p>warm content</p>
      </Modal>,
    )
    expect(screen.getByText('warm content')).toBeInTheDocument()
    rerender(
      <Modal isOpen={false} onClose={() => {}} ariaLabel="Test" keepMounted>
        <p>warm content</p>
      </Modal>,
    )
    // Still in the DOM (not torn down), so the icon subtree never re-fetches.
    expect(screen.getByText('warm content')).toBeInTheDocument()
    const backdrop = screen.getByTestId('modal-backdrop')
    expect(backdrop).toHaveAttribute('inert')
  })

  it('does not call onClose on ESC when closed but kept mounted', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal isOpen={false} onClose={onClose} ariaLabel="Test" keepMounted>
        <p>warm content</p>
      </Modal>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('wraps Tab from the last focusable back to the first (forward trap)', async () => {
    const user = userEvent.setup()
    render(
      <Modal isOpen onClose={() => {}} ariaLabel="Test" hideClose>
        <button type="button">first</button>
        <button type="button">last</button>
      </Modal>,
    )
    const first = screen.getByRole('button', { name: 'first' })
    const last = screen.getByRole('button', { name: 'last' })
    last.focus()
    expect(document.activeElement).toBe(last)
    await user.tab()
    expect(document.activeElement).toBe(first)
  })

  it('wraps Shift+Tab from the first focusable to the last (reverse trap)', async () => {
    const user = userEvent.setup()
    render(
      <Modal isOpen onClose={() => {}} ariaLabel="Test" hideClose>
        <button type="button">first</button>
        <button type="button">last</button>
      </Modal>,
    )
    const first = screen.getByRole('button', { name: 'first' })
    const last = screen.getByRole('button', { name: 'last' })
    first.focus()
    expect(document.activeElement).toBe(first)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(last)
  })
})
