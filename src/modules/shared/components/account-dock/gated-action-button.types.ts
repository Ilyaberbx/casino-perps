import type { LucideIcon } from 'lucide-react'

export interface GatedActionButtonProps {
  /** Lucide icon rendered inside the button (e.g. `X` for cancel/close). */
  readonly icon: LucideIcon
  /** Click handler invoked when the predicate is ready. */
  readonly onClick: () => void
  /**
   * Tooltip shown on the desktop disabled state (`title` attribute).
   * Also used as the `aria-label` for the info-icon so screen readers
   * announce why the button is disabled.
   */
  readonly disabledTooltip: string
  /** Accessible label for the action button (e.g. "Cancel order"). */
  readonly ariaLabel: string
}
