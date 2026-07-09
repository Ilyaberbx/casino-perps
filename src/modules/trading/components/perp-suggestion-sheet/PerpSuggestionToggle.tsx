import { usePerpSuggestionSheet } from '../../providers/perp-suggestion-sheet-provider'
import { AiMascot } from '@/modules/shared/components/ai-marker'
import styles from './perp-suggestion-sheet.module.css'
import type { PerpSuggestionToggleProps } from './perp-suggestion-sheet.types'

/**
 * The left-edge AI affordance (slice 07). The three-eye mascot marks it (a CSS
 * micro-idle bob, compositor-only, degraded under reduced-motion) on a quiet
 * tinted band; clicking opens the AI Sheet via the provider controller. The
 * sheet never auto-opens.
 *
 * `hidden` slides it off the left edge while the AccountDock is scrolled into its
 * row (TradingPage drives it), so it never covers the dock table; off-screen it
 * is non-interactive (pointer-events:none + removed from the a11y tree/tab order).
 */
export function PerpSuggestionToggle({ hidden = false }: PerpSuggestionToggleProps) {
  const { open } = usePerpSuggestionSheet()
  const className = hidden ? `${styles.toggle} ${styles.toggleHidden}` : styles.toggle
  return (
    <button
      type="button"
      className={className}
      onClick={open}
      aria-label="Ask AI"
      title="Ask AI"
      aria-hidden={hidden}
      tabIndex={hidden ? -1 : undefined}
      data-testid="perp-suggestion-toggle"
    >
      <AiMascot size={24} className={styles.toggleIcon} />
    </button>
  )
}
