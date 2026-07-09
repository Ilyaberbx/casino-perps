import { useEffect, useRef, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { IconButton } from '../icon-button'
import styles from './modal.module.css'
import { wrapTabFocus } from './modal.utils'
import type { ModalProps } from './modal.types'

export function Modal({
  isOpen,
  onClose,
  ariaLabel,
  title,
  size = 'md',
  hideClose = false,
  keepMounted = false,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      wrapTabFocus(dialog, e, { includeOutsideActive: true })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    return () => {
      previouslyFocused?.focus?.()
    }
  }, [isOpen])

  const isUnmountedWhenClosed = !isOpen && !keepMounted
  if (isUnmountedWhenClosed) return null

  function onBackdropClick(e: MouseEvent<HTMLDivElement>): void {
    if (e.target === e.currentTarget) onClose()
  }

  const isHidden = !isOpen
  const backdropClass = isHidden ? `${styles.backdrop} ${styles.hidden}` : styles.backdrop

  return createPortal(
    <div
      className={backdropClass}
      data-testid="modal-backdrop"
      onClick={onBackdropClick}
      inert={isHidden}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={styles.dialog}
        data-size={size}
      >
        {title !== undefined ? (
          <header className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            {!hideClose && (
              <IconButton icon={X} ariaLabel="Close" title="Close" onClick={onClose} />
            )}
          </header>
        ) : !hideClose ? (
          <IconButton
            icon={X}
            ariaLabel="Close"
            title="Close"
            onClick={onClose}
            className={styles.closeFloating}
          />
        ) : null}
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body,
  )
}
