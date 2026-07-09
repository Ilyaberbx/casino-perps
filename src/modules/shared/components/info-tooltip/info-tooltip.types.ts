import type { ReactNode, RefObject } from 'react'
import type { PopoverPlacement } from '../popover'

export interface InfoTooltipProps {
  /** The inline trigger text (gets the dotted underline). */
  readonly label: ReactNode
  /** The floating panel content (string copy, or a rich breakdown node). */
  readonly content: ReactNode
  readonly placement?: PopoverPlacement
  readonly className?: string
  readonly triggerAriaLabel?: string
}

export interface UseInfoTooltipReturn {
  readonly isOpen: boolean
  readonly triggerRef: RefObject<HTMLButtonElement | null>
  readonly panelRef: RefObject<HTMLDivElement | null>
  open(): void
  close(): void
  toggle(): void
}
