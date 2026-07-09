import { SegmentedControl } from '@/modules/shared/components/segmented-control'
import styles from './order-entry.module.css'
import type { SideToggleProps } from './order-entry.types'
import type { Side } from '../../../shared/domain/domain.types'

const PERP_OPTIONS: ReadonlyArray<{ value: Side; label: string }> = [
  { value: 'buy', label: 'Long' },
  { value: 'sell', label: 'Short' },
]

// Spot has no long/short — a buy/sell swaps the base token against USDC.
const SPOT_OPTIONS: ReadonlyArray<{ value: Side; label: string }> = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
]

export function SideToggle({ side, isSpot, onSideChange }: SideToggleProps) {
  const tone = side === 'buy' ? 'directionUp' : 'directionDown'
  const options = isSpot ? SPOT_OPTIONS : PERP_OPTIONS
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
