import { createPortal } from 'react-dom'
import { Toast } from './Toast'
import styles from './toast.module.css'
import type { ToastContainerProps } from './toast.types'
import { TOAST_STACK_CAP } from '@/modules/shared/services/toast'

export function ToastContainer({ records, exitingIds, onDismiss }: ToastContainerProps) {
  const visible = records.slice(0, TOAST_STACK_CAP)
  const hasNone = visible.length === 0
  if (hasNone) return null
  // Portal to <body>, OUTSIDE React's #root. An open Sheet sets `inert` on #root
  // to trap focus behind it; a toast rendered inside #root would inherit that
  // inertness and its close/action buttons would stop responding to clicks even
  // though it paints on top (--z-toast > --z-sheet). Portaling to body — the same
  // target Sheet/Modal/Popover use — keeps the toast interactive over any overlay
  // and seats it in the root stacking context so the z-scale compares cleanly.
  return createPortal(
    <div className={styles.container} data-testid="toast-container">
      {visible.map((record) => (
        <Toast
          key={record.id}
          record={record}
          isExiting={exitingIds.has(record.id)}
          onDismiss={onDismiss}
        />
      ))}
    </div>,
    document.body,
  )
}
