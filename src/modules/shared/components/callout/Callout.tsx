import styles from './callout.module.css'
import { CALLOUT_ICON, CALLOUT_ROLE } from './callout.constants'
import type { CalloutProps, CalloutVariant } from './callout.types'

const variantClass: Record<CalloutVariant, string> = {
  warning: styles.variantWarning,
  error: styles.variantError,
  info: styles.variantInfo,
}

export function Callout({ variant, label, children }: CalloutProps) {
  const className = `${styles.callout} ${variantClass[variant]}`

  return (
    <div className={className} role={CALLOUT_ROLE[variant]}>
      <span className={styles.icon} aria-hidden="true">
        {CALLOUT_ICON[variant]}
      </span>
      <div className={styles.body}>
        <span className={styles.label}>{label}</span>
        <span className={styles.prose}>{children}</span>
      </div>
    </div>
  )
}
