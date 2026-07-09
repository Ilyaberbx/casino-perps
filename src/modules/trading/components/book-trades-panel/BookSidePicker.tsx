import { Rows3, PanelTop, PanelBottom } from 'lucide-react'
import { SegmentedControl } from '@/modules/shared/components/segmented-control'
import type { SegmentedControlOption } from '@/modules/shared/components/segmented-control'
import type { BookSide, BookSidePickerProps } from './book-trades-panel.types'
import styles from './book-trades-panel.module.css'

const SIDE_ICON_SIZE = 14

/**
 * The nado-style both / bids / asks toggle. Icon-only segments: `Rows3` (both),
 * `PanelBottom` (bids — the lower half, tinted green) and `PanelTop` (asks — the
 * upper half, tinted red). Active state is a soft direction wash keyed per option
 * (green / red / cyan) via `.sidePicker` in the stylesheet, so the icons stay
 * legible on the tint. Shared by the desktop `BookTradesPanel` and the mobile
 * `MobileTabPanel` so the control behaves identically across layouts.
 */
const SIDE_OPTIONS: ReadonlyArray<SegmentedControlOption<BookSide>> = [
  { value: 'both', label: <Rows3 size={SIDE_ICON_SIZE} />, ariaLabel: 'Show both sides' },
  {
    value: 'bids',
    label: <PanelBottom size={SIDE_ICON_SIZE} className={styles.bidIcon} />,
    ariaLabel: 'Show bids only',
  },
  {
    value: 'asks',
    label: <PanelTop size={SIDE_ICON_SIZE} className={styles.askIcon} />,
    ariaLabel: 'Show asks only',
  },
]

export function BookSidePicker({ value, onChange }: BookSidePickerProps) {
  return (
    <SegmentedControl<BookSide>
      options={SIDE_OPTIONS}
      value={value}
      onChange={onChange}
      ariaLabel="Order book side"
      className={styles.sidePicker}
    />
  )
}
