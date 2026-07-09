import type { ReactNode } from 'react'

export type SegmentedControlTone = 'accent' | 'directionUp' | 'directionDown'

export type SegmentedControlVariant = 'filled' | 'underline'

export interface SegmentedControlOption<TValue extends string> {
  value: TValue
  label: ReactNode
  disabled?: boolean
  ariaLabel?: string
}

export interface SegmentedControlProps<TValue extends string> {
  options: ReadonlyArray<SegmentedControlOption<TValue>>
  value: TValue
  onChange: (value: TValue) => void
  tone?: SegmentedControlTone
  /** Visual treatment. `'filled'` (default) is the solid-active-segment skin;
   *  `'underline'` renders active tabs as tone-coloured underline tabs (no
   *  fill) — used by the Long/Short side toggle. Keyboard/a11y is identical. */
  variant?: SegmentedControlVariant
  ariaLabel?: string
  className?: string
}
