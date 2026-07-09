import type { CloseKind, CloseSizeBasis } from './account-dock.types'

export interface UseClosePositionDialogReturn {
  kind: CloseKind
  sizeBasis: CloseSizeBasis
  sizeInput: string
  priceInput: string
  /** Resolved reduce-only close size (clamped to the open position size). */
  resolvedSize: number
  isSizeValid: boolean
  isPriceValid: boolean
  canSubmit: boolean
  setKind: (kind: CloseKind) => void
  setSizeBasis: (basis: CloseSizeBasis) => void
  setSizeInput: (value: string) => void
  setPriceInput: (value: string) => void
  submit: () => void
}
