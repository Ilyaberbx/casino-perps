import type { SegmentedControlOption } from '@/modules/shared/components/segmented-control'
import type { MarketType } from './fee-schedule-modal.types'

export const MARKET_TYPE_OPTIONS: ReadonlyArray<SegmentedControlOption<MarketType>> = [
  { value: 'spot', label: 'Spot' },
  { value: 'perps', label: 'Perps' },
] as const
