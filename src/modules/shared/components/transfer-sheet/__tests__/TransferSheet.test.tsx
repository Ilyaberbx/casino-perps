import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransferSheet } from '../TransferSheet'
import {
  TRANSFER_BODY_TEXT,
  buildVenueWithTransfer,
  buildVenueWithoutTransfer,
  wrapWithTransferVenue,
} from '../__fixtures__/fake-transfer-venue'

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

describe('TransferSheet', () => {
  it('renders the active venue transfer body when applicable and open', () => {
    const wrapper = wrapWithTransferVenue({
      venue: buildVenueWithTransfer({ isApplicable: true }),
      defaultSheetOpen: true,
    })
    renderInRoot(<TransferSheet />, wrapper)

    expect(screen.getByTestId('transfer-body')).toHaveTextContent(TRANSFER_BODY_TEXT)
    expect(screen.getByRole('dialog', { name: 'Transfer funds' })).toBeInTheDocument()
  })

  it('renders nothing when the active venue has no transfer capability', () => {
    const wrapper = wrapWithTransferVenue({
      venue: buildVenueWithoutTransfer(),
      defaultSheetOpen: true,
    })
    renderInRoot(<TransferSheet />, wrapper)

    expect(screen.queryByTestId('transfer-body')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sheet-dialog')).not.toBeInTheDocument()
  })

  it('does not render the body when the account is not applicable (unified)', () => {
    const wrapper = wrapWithTransferVenue({
      venue: buildVenueWithTransfer({ isApplicable: false }),
      defaultSheetOpen: true,
    })
    renderInRoot(<TransferSheet />, wrapper)

    // The shell mounts (capability present) but the inner gate suppresses the body.
    expect(screen.queryByTestId('transfer-body')).not.toBeInTheDocument()
  })

  it('does not mount the venue transfer chrome while closed', () => {
    const wrapper = wrapWithTransferVenue({
      venue: buildVenueWithTransfer({ isApplicable: true }),
      defaultSheetOpen: false,
    })
    renderInRoot(<TransferSheet />, wrapper)

    const dialog = screen.queryByTestId('sheet-dialog') as HTMLDialogElement | null
    expect(dialog?.hasAttribute('open')).toBe(false)
    expect(screen.queryByTestId('transfer-body')).not.toBeInTheDocument()
  })
})
