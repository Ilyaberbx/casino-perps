import styles from './badge.module.css'
import { TONE_CLASS } from './badge.constants'
import type { BadgeProps } from './badge.types'

export function Badge({
  children,
  tone = 'neutral',
  size = 'sm',
  className,
  'aria-label': ariaLabel,
}: BadgeProps) {
  const sizeClass = size === 'md' ? styles.sizeMd : undefined
  const badgeClass = [styles.badge, TONE_CLASS[tone], sizeClass, className].filter(Boolean).join(' ')
  return (
    <span className={badgeClass} aria-label={ariaLabel}>
      {children}
    </span>
  )
}
