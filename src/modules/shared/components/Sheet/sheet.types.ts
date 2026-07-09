import type { ReactNode } from 'react'

export type SheetSide = 'right' | 'bottom' | 'left'

export interface SheetProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly side: SheetSide
  /** Accessible label for the dialog. Required for a11y. */
  readonly ariaLabel: string
  /**
   * Optional visible heading. When set, the sheet renders a standardized header
   * row (title + close) with a divider — the consistent header for plain sheets.
   * Omit it when the body draws its own richer header (e.g. the AI mascot band).
   */
  readonly title?: string
  /** Hide the built-in close button (rare; the body provides its own). */
  readonly hideClose?: boolean
  readonly children: ReactNode
}
