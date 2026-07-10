import type { LiveWin } from '../../social.types'

export interface LiveWinsViewModel {
  readonly wins: LiveWin[]
  /** Whether the marquee should scroll — false under prefers-reduced-motion. */
  readonly isAnimated: boolean
}

export interface LiveWinCardProps {
  readonly win: LiveWin
  /** Set on the duplicated marquee copy so screen readers read the strip once. */
  readonly ariaHidden?: boolean
}
