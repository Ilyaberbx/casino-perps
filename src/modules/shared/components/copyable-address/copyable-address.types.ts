/** Horizontal alignment of the address+Copy pill within its wrapper. */
export type CopyableAddressAlign = 'center' | 'start'

export interface CopyableAddressProps {
  /** The full raw address. Displayed truncated; the full value is copied. */
  readonly address: string
  /** Optional QR size in px; when provided the QR is rendered above the row. */
  readonly qrSize?: number
  /** Defaults to `'center'` — the original deposit/QR track behavior. */
  readonly align?: CopyableAddressAlign
}

export type ClipboardErrorKind = 'copy-failed'

export interface ClipboardError {
  readonly kind: ClipboardErrorKind
  readonly cause: unknown
}
