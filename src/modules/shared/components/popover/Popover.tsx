import { createPortal } from 'react-dom'
import { usePopoverPosition } from './use-popover-position'
import type { PopoverProps } from './popover.types'

/**
 * Render-only portal primitive for anchored floating panels (dropdowns,
 * listboxes). Portals its children to `document.body` so no ancestor `overflow`
 * can clip them, and positions the panel against `anchorRef` via
 * `usePopoverPosition`. It owns *only* placement — open/close state, listbox
 * semantics, keyboard handling, and focus management stay with the consumer.
 * Mount it only while open (gate at the call site); unmounting tears down the
 * positioning listeners. See ADR-0037.
 */
export function Popover<
  A extends HTMLElement = HTMLElement,
  P extends HTMLElement = HTMLElement,
>({ anchorRef, panelRef, placement = 'bottom-start', children }: PopoverProps<A, P>) {
  usePopoverPosition({ anchorRef, panelRef, placement })
  return createPortal(children, document.body)
}
