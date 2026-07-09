export interface FeeScheduleModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
}

export type MarketType = 'spot' | 'perps'
