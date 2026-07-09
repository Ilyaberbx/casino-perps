import type { ReactNode, CSSProperties, Ref } from 'react'

export interface ScrollAreaProps {
  children: ReactNode
  className?: string
  viewportClassName?: string
  style?: CSSProperties
  ariaLabel?: string
  /**
   * Optional ref forwarded to the inner viewport `<div>` — i.e. the
   * element that actually scrolls. Consumers needing a `getScrollElement`
   * (virtualization, scroll-restoration, intersection observers) read
   * from this ref.
   */
  viewportRef?: Ref<HTMLDivElement>
}
