import { PixelButton } from '@/modules/shared/components/pixel-button'
import type { FlowPercentChipsProps } from './flow-percent-chips.types'

/**
 * The 25 / 50 / 75 / 100% quick-fill chips for a flow's available balance. Each
 * fires `onPercent`; the parent's hook computes the clamped amount. Shared across
 * modules (HL send / withdraw / evm-core bodies and the agent-balance withdraw
 * body) — the per-flow `styles` (CSS-module class map) and `chips` values are
 * passed as props so the DOM + class hooks stay identical wherever it renders.
 */
export function FlowPercentChips<P extends number>({
  styles,
  chips,
  disabled,
  onPercent,
}: FlowPercentChipsProps<P>) {
  return (
    <div className={styles.chips}>
      {chips.map((percent) => (
        <PixelButton
          key={percent}
          type="button"
          variant="default"
          size="sm"
          className={styles.chip}
          disabled={disabled}
          onClick={() => onPercent(percent)}
        >
          {percent}%
        </PixelButton>
      ))}
    </div>
  )
}
