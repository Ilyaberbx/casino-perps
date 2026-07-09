export interface UseModifyOrderDialogReturn {
  priceInput: string
  sizeInput: string
  canSubmit: boolean
  setPriceInput: (value: string) => void
  setSizeInput: (value: string) => void
  submit: () => void
}
