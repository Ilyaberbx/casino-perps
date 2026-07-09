import type { ReactNode } from 'react'

export interface PlaceholderMessageProps {
  /** Message text. If `children` is provided, this is ignored. */
  message?: ReactNode
  children?: ReactNode
  /** Optional action slot (button/link) rendered below the message. */
  action?: ReactNode
  /** Tone hint — `error` colors the message in directionDown. */
  tone?: 'neutral' | 'error'
  className?: string
}
