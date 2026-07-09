import styles from './scroll-area.module.css'
import type { ScrollAreaProps } from './scroll-area.types'

export function ScrollArea({
  children,
  className,
  viewportClassName,
  style,
  ariaLabel,
  viewportRef,
}: ScrollAreaProps) {
  const outerClass = className ? `${styles.outer} ${className}` : styles.outer
  const viewportClass = viewportClassName
    ? `${styles.viewport} ${viewportClassName}`
    : styles.viewport

  return (
    <div className={outerClass} style={style}>
      <div
        ref={viewportRef}
        className={viewportClass}
        aria-label={ariaLabel}
        role="region"
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  )
}
