import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sheet } from '../Sheet'

// jsdom does not implement HTMLDialogElement's open/close methods. The Sheet
// opens its dialog non-modally via `show()`; polyfill the surface we touch with
// the minimum behaviour the tests assert against (the `open` flag + `close`).
type DialogProto = HTMLDialogElement & {
  show(): void
  showModal(): void
  close(): void
  open: boolean
}

function installDialogPolyfill(): void {
  const proto = HTMLDialogElement.prototype as DialogProto
  const marker = proto.show as unknown as { __polyfilled?: boolean } | undefined
  if (marker && marker.__polyfilled) return
  const open = function open(this: HTMLDialogElement): void {
    this.setAttribute('open', '')
    Object.defineProperty(this, 'open', { configurable: true, value: true })
  }
  ;(open as unknown as { __polyfilled: boolean }).__polyfilled = true
  proto.show = open
  proto.showModal = open
  proto.close = function close(this: HTMLDialogElement): void {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    Object.defineProperty(this, 'open', { configurable: true, value: false })
    this.dispatchEvent(new Event('close'))
  }
}

beforeEach(() => {
  installDialogPolyfill()
  document.body.innerHTML = ''
  const root = document.createElement('div')
  root.id = 'root'
  document.body.appendChild(root)
})

function renderInRoot(ui: React.ReactElement) {
  const root = document.getElementById('root') as HTMLElement
  return render(ui, { container: root })
}

describe('Sheet', () => {
  it('does not show modal content when isOpen is false', () => {
    renderInRoot(
      <Sheet isOpen={false} onClose={() => {}} side="right" ariaLabel="Test sheet">
        <p>hidden content</p>
      </Sheet>,
    )
    const dialog = screen.getByTestId('sheet-dialog') as HTMLDialogElement
    expect(dialog.open).toBe(false)
  })

  it('opens the native dialog when isOpen flips to true', () => {
    renderInRoot(
      <Sheet isOpen onClose={() => {}} side="right" ariaLabel="Test sheet">
        <p>visible content</p>
      </Sheet>,
    )
    const dialog = screen.getByTestId('sheet-dialog') as HTMLDialogElement
    expect(dialog.open).toBe(true)
    expect(screen.getByText('visible content')).toBeInTheDocument()
  })

  it('exposes ariaLabel on the dialog element', () => {
    renderInRoot(
      <Sheet isOpen onClose={() => {}} side="right" ariaLabel="Onboarding">
        <p>body</p>
      </Sheet>,
    )
    expect(screen.getByTestId('sheet-dialog')).toHaveAttribute('aria-label', 'Onboarding')
  })

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderInRoot(
      <Sheet isOpen onClose={onClose} side="right" ariaLabel="Test">
        <p>body</p>
      </Sheet>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderInRoot(
      <Sheet isOpen onClose={onClose} side="right" ariaLabel="Test">
        <p>body</p>
      </Sheet>,
    )
    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the scrim backdrop is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderInRoot(
      <Sheet isOpen onClose={onClose} side="right" ariaLabel="Test">
        <p>body</p>
      </Sheet>,
    )
    await user.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onClose when clicking inside the sheet content', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderInRoot(
      <Sheet isOpen onClose={onClose} side="right" ariaLabel="Test">
        <p data-testid="inner">body</p>
      </Sheet>,
    )
    await user.click(screen.getByTestId('inner'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('moves focus to the close button on open', () => {
    renderInRoot(
      <Sheet isOpen onClose={() => {}} side="right" ariaLabel="Test">
        <p>body</p>
      </Sheet>,
    )
    const closeButton = screen.getByRole('button', { name: /close/i })
    expect(document.activeElement).toBe(closeButton)
  })

  it('restores focus to the opener when the sheet closes', () => {
    const opener = document.createElement('button')
    opener.textContent = 'Open'
    document.body.appendChild(opener)
    opener.focus()
    expect(document.activeElement).toBe(opener)

    const { rerender } = renderInRoot(
      <Sheet isOpen onClose={() => {}} side="right" ariaLabel="Test">
        <p>body</p>
      </Sheet>,
    )
    expect(document.activeElement).not.toBe(opener)

    rerender(
      <Sheet isOpen={false} onClose={() => {}} side="right" ariaLabel="Test">
        <p>body</p>
      </Sheet>,
    )
    expect(document.activeElement).toBe(opener)
  })

  it("applies the 'inert' attribute to #root while open and removes it on close", () => {
    const root = document.getElementById('root') as HTMLElement

    const { rerender } = renderInRoot(
      <Sheet isOpen onClose={() => {}} side="right" ariaLabel="Test">
        <p>body</p>
      </Sheet>,
    )
    expect(root.hasAttribute('inert')).toBe(true)

    rerender(
      <Sheet isOpen={false} onClose={() => {}} side="right" ariaLabel="Test">
        <p>body</p>
      </Sheet>,
    )
    expect(root.hasAttribute('inert')).toBe(false)
  })

  it('renders the bottom-side class when side="bottom"', () => {
    renderInRoot(
      <Sheet isOpen onClose={() => {}} side="bottom" ariaLabel="Test">
        <p>body</p>
      </Sheet>,
    )
    const dialog = screen.getByTestId('sheet-dialog')
    // CSS modules hash class names; "bottom" is enough as a substring marker.
    expect(dialog.className).toMatch(/bottom/)
  })

  it('renders the right-side class when side="right"', () => {
    renderInRoot(
      <Sheet isOpen onClose={() => {}} side="right" ariaLabel="Test">
        <p>body</p>
      </Sheet>,
    )
    const dialog = screen.getByTestId('sheet-dialog')
    expect(dialog.className).toMatch(/right/)
  })

  it('renders the left-side class when side="left"', () => {
    renderInRoot(
      <Sheet isOpen onClose={() => {}} side="left" ariaLabel="Test">
        <p>body</p>
      </Sheet>,
    )
    const dialog = screen.getByTestId('sheet-dialog')
    // CSS modules hash class names; "left" is enough as a substring marker.
    expect(dialog.className).toMatch(/left/)
  })
})
