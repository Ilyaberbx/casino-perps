import styles from './coming-soon.module.css'
import type { ComingSoonProps } from './coming-soon.types'

/**
 * A minimal "Coming soon" placeholder for stub routes (PRD 0008 D15 —
 * `/leaderboard`). Pure presentational; the caller supplies the heading.
 */
export function ComingSoon({ title = 'Coming soon', className }: ComingSoonProps) {
  const rootClass = className ? `${styles.root} ${className}` : styles.root
  return (
    <div className={rootClass} data-testid="coming-soon">
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.body}>This is not ready yet. Check back later.</p>
    </div>
  )
}
