import styles from './empty-state.module.css'
import type { EmptyStateProps } from './empty-state.types'

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className={styles.container} role="status">
      {message}
    </div>
  )
}
