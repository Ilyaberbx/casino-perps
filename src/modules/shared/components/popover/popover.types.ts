import type { ReactNode, RefObject } from 'react'

/** Where the panel sits relative to its anchor. Both open downward; the hook
 *  flips above the anchor when there is not enough room below. */
export type PopoverPlacement = 'bottom-start' | 'bottom-end'

export interface PopoverProps<
  A extends HTMLElement = HTMLElement,
  P extends HTMLElement = HTMLElement,
> {
  /** The element the panel is positioned against (the trigger). */
  anchorRef: RefObject<A | null>
  /** The floating panel itself. The consumer attaches this same ref to its
   *  panel node; the hook measures and writes inline position to it. */
  panelRef: RefObject<P | null>
  /** Horizontal alignment to the anchor. Defaults to `bottom-start`. */
  placement?: PopoverPlacement
  children: ReactNode
}

export interface UsePopoverPositionParams<
  A extends HTMLElement = HTMLElement,
  P extends HTMLElement = HTMLElement,
> {
  anchorRef: RefObject<A | null>
  panelRef: RefObject<P | null>
  placement: PopoverPlacement
}
