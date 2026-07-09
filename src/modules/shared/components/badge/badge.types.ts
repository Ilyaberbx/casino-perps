import type { ReactNode } from 'react'

/**
 * Semantic colour of a badge. The glass chrome is identical across tones; only the
 * text + border colour change. `neutral` is the default provenance/label tone.
 */
export type BadgeTone = 'directionUp' | 'directionDown' | 'accent' | 'neutral'

/** Font scale. `sm` (9px) is the default; `md` (11px) for the denser market-row badge. */
export type BadgeSize = 'sm' | 'md'

export interface BadgeProps {
  children: ReactNode
  /** Tone colour for text + border. Defaults to `neutral`. */
  tone?: BadgeTone
  /** Font scale. Defaults to `sm`. */
  size?: BadgeSize
  className?: string
  'aria-label'?: string
}
