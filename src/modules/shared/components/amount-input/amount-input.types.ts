export interface AmountInputProps {
  /** Current raw string value (controlled). Numbers render in `--font-trading`. */
  readonly value: string
  readonly onChange: (value: string) => void
  /** Accessible label for the field. */
  readonly label: string
  /** When false, the field shows the invalid styling + `aria-invalid`. */
  readonly isValid: boolean
  readonly disabled?: boolean
  /** Inline reason rendered + wired via `aria-describedby` when invalid. */
  readonly invalidReason?: string
  /** Optional unit suffix shown inside the field (e.g. "USDC"). */
  readonly unit?: string
  /** Optional MAX affordance; rendered only when provided. */
  readonly onMax?: () => void
}
