import type { ReactNode } from 'react'

export type CalloutVariant = 'warning' | 'error' | 'info'

export interface CalloutProps {
  readonly variant: CalloutVariant
  /** Short pixel-font label rendered next to the icon (e.g. "Warning"). */
  readonly label: string
  /** Prose body, rendered in the data/mono font (multi-line prose rule). */
  readonly children: ReactNode
}
