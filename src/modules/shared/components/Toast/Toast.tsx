import styles from './toast.module.css'
import type { ToastProps } from './toast.types'
import { ariaLiveForVariant, variantIconGlyph } from './toast.utils'

const variantClassMap = {
  success: styles.variantSuccess,
  error: styles.variantError,
  warning: styles.variantWarning,
  info: styles.variantInfo,
} as const

const iconClassMap = {
  success: styles.iconSuccess,
  error: styles.iconError,
  warning: styles.iconWarning,
  info: styles.iconInfo,
} as const

export function Toast({ record, isExiting, onDismiss }: ToastProps) {
  const ariaLive = ariaLiveForVariant(record.variant)
  const variantClass = variantClassMap[record.variant]
  const iconClass = iconClassMap[record.variant]

  return (
    <div
      className={`${styles.toast} ${variantClass}`}
      role={ariaLive === 'assertive' ? 'alert' : 'status'}
      aria-live={ariaLive}
      data-testid={`toast-${record.id}`}
      data-variant={record.variant}
      data-state={isExiting ? 'exiting' : 'visible'}
      onClick={() => onDismiss(record.id)}
    >
      <span className={`${styles.icon} ${iconClass}`} aria-hidden="true">
        {variantIconGlyph(record.variant)}
      </span>
      <div className={styles.body}>
        <span className={styles.title}>{record.title}</span>
        {record.description ? (
          <span className={styles.description}>{record.description}</span>
        ) : null}
      </div>
      {record.action ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.actionButton}
            onClick={(event) => {
              event.stopPropagation()
              record.action?.onClick()
            }}
          >
            {record.action.label}
          </button>
        </div>
      ) : null}
    </div>
  )
}
