import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { IconButton } from '../icon-button'
import { wrapTabFocus } from '../modal/modal.utils'
import styles from './sheet.module.css'
import type { SheetProps, SheetSide } from './sheet.types'

const ROOT_ELEMENT_ID = 'root'

const SIDE_CLASS: Record<SheetSide, string> = {
  right: styles.right,
  bottom: styles.bottom,
  left: styles.left,
}

export function Sheet({
  isOpen,
  onClose,
  side,
  ariaLabel,
  title,
  hideClose = false,
  children,
}: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!isOpen && dialog.open) dialog.close()
    if (!isOpen) return

    openerRef.current = document.activeElement as HTMLElement | null
    // `show()` (non-modal), not `showModal()`: a modal dialog joins the browser
    // top layer, which paints above every z-index — including Privy's wallet
    // modal (a body-level div at z-index 999999). Staying off the top layer lets
    // the sheet sit at `--z-sheet` (1300), below Privy, so its pop-up overlays
    // the sheet. The `[open]` attribute is still set, so the slide CSS is intact.
    dialog.show()
    closeButtonRef.current?.focus()

    const root = document.getElementById(ROOT_ELEMENT_ID)
    root?.setAttribute('inert', '')

    // `inert` blocks interaction but not wheel/touch scrolling, so the page would
    // scroll away behind an open sheet. Lock it, same as `Modal`.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
      root?.removeAttribute('inert')
      openerRef.current?.focus?.()
    }
  }, [isOpen])

  // A non-modal dialog gives up the native focus-trap, ESC-to-close, and
  // `::backdrop`. ESC + Tab-trap are restored here; the scrim is a sibling
  // element (below); `inert` on #root keeps background focus out.
  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e: KeyboardEvent): void {
      const isEscape = e.key === 'Escape'
      if (isEscape) {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      wrapTabFocus(dialog, e, { includeOutsideActive: true })
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  const sideClass = SIDE_CLASS[side]

  const closeButton = hideClose ? null : (
    <IconButton ref={closeButtonRef} icon={X} ariaLabel="Close" title="Close" onClick={onClose} />
  )

  const hasStandardHeader = title !== undefined
  const backdropClass = isOpen ? `${styles.backdrop} ${styles.open}` : styles.backdrop

  return createPortal(
    <>
      <div
        className={backdropClass}
        data-testid="sheet-backdrop"
        onClick={onClose}
        inert={!isOpen}
      />
      <dialog
        ref={dialogRef}
        className={`${styles.dialog} ${sideClass}`}
        aria-label={ariaLabel}
        data-testid="sheet-dialog"
      >
        <div className={styles.body}>
          {hasStandardHeader ? (
            <header className={styles.header}>
              <h2 className={styles.title}>{title}</h2>
              {closeButton}
            </header>
          ) : (
            <div className={styles.closeRow}>{closeButton}</div>
          )}
          {children}
        </div>
      </dialog>
    </>,
    document.body,
  )
}
