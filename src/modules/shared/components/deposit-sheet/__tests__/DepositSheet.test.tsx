import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DepositSheet } from '../DepositSheet'
import {
  DEPOSIT_BODY_TEXT,
  buildVenueWithDeposit,
  buildVenueWithoutDeposit,
  wrapWithDepositVenue,
} from '../__fixtures__/fake-deposit-venue'

// jsdom does not implement <dialog> showModal/close; install the same minimal
// polyfill the Sheet primitive's own tests use.
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

function renderInRoot(
  ui: React.ReactElement,
  wrapper: React.ComponentType<{ children: React.ReactNode }>,
) {
  const root = document.getElementById('root') as HTMLElement
  return render(ui, { container: root, wrapper })
}

describe('DepositSheet', () => {
  it('renders the active venue deposit body when the capability is present and open', () => {
    const wrapper = wrapWithDepositVenue({ venue: buildVenueWithDeposit(), defaultSheetOpen: true })
    renderInRoot(<DepositSheet />, wrapper)

    expect(screen.getByTestId('deposit-body')).toHaveTextContent(DEPOSIT_BODY_TEXT)
    expect(screen.getByRole('dialog', { name: 'Deposit funds' })).toBeInTheDocument()
  })

  it('renders nothing when the active venue has no deposit capability', () => {
    const wrapper = wrapWithDepositVenue({
      venue: buildVenueWithoutDeposit(),
      defaultSheetOpen: true,
    })
    renderInRoot(<DepositSheet />, wrapper)

    expect(screen.queryByTestId('deposit-body')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sheet-dialog')).not.toBeInTheDocument()
  })

  it('does not mount the venue deposit chrome while closed', () => {
    const wrapper = wrapWithDepositVenue({
      venue: buildVenueWithDeposit(),
      defaultSheetOpen: false,
    })
    renderInRoot(<DepositSheet />, wrapper)

    // The chrome (provider + body) is mounted only while open, so the venue's
    // deposit state machine never preflights eagerly. The dialog shell exists
    // but is closed and carries no body.
    const dialog = screen.queryByTestId('sheet-dialog') as HTMLDialogElement | null
    expect(dialog?.hasAttribute('open')).toBe(false)
    expect(screen.queryByTestId('deposit-body')).not.toBeInTheDocument()
  })
})
