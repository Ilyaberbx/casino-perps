import type { ReactNode } from 'react'

export type StatRowTone = 'neutral' | 'up' | 'down' | 'muted'

export interface StatRowProps {
  label: ReactNode
  value: ReactNode
  tone?: StatRowTone
  /** Drop the bottom border (use when row is last in a stack and stack has its own outer border). */
  noDivider?: boolean
  className?: string
}
