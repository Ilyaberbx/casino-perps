import { SegmentedControl } from '@/modules/shared/components/segmented-control'
import styles from './order-entry.module.css'
import type { SideToggleProps } from './order-entry.types'
import type { Side } from '../../../shared/domain/domain.types'

const PERP_OPTIONS: ReadonlyArray<{ value: Side; label: string }> = [
  { value: 'buy', label: 'Long' },
  { value: 'sell', label: 'Short' },
]

export function SideToggle({ side, onSideChange }: SideToggleProps) {
  const tone = side === 'buy' ? 'directionUp' : 'directionDown'
  const options = PERP_OPTIONS
  return (
    <div className={styles.fullWidthSegment}>
      <SegmentedControl<Side>
        options={options}
        value={side}
        onChange={onSideChange}
        tone={tone}
        variant="underline"
        ariaLabel="Order side"
      />
    </div>
  )
}
