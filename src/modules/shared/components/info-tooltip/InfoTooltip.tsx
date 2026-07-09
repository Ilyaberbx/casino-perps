import { Popover } from '../popover'
import { useInfoTooltip } from './use-info-tooltip'
import type { InfoTooltipProps } from './info-tooltip.types'
import styles from './info-tooltip.module.css'

/**
 * An inline, dotted-underline trigger that reveals an anchored explanatory panel
 * on hover / focus / tap. Built on the shared `Popover` (portaled, so no ancestor
 * `overflow` clips it). Content can be plain copy or a rich breakdown node.
 * Reduced-motion drops the entrance animation. Dumb leaf + colocated hook.
 */
export function InfoTooltip({
  label,
  content,
  placement = 'bottom-start',
  className,
  triggerAriaLabel,
}: InfoTooltipProps) {
  const { isOpen, triggerRef, panelRef, open, close, toggle } = useInfoTooltip()
  const triggerClass = className ? `${styles.trigger} ${className}` : styles.trigger

  return (
    <span className={styles.wrapper}>
      <button
        type="button"
        ref={triggerRef}
        className={triggerClass}
        aria-label={triggerAriaLabel}
        aria-expanded={isOpen}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        onClick={toggle}
      >
        {label}
      </button>
      {isOpen ? (
        <Popover anchorRef={triggerRef} panelRef={panelRef} placement={placement}>
          <div ref={panelRef} className={styles.panel} role="tooltip">
            {content}
          </div>
        </Popover>
      ) : null}
    </span>
  )
}
