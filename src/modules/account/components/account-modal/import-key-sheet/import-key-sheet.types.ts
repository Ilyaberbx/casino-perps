/** Props for the `ImportKeySheet` component. */
export interface ImportKeySheetProps {
  /** Disables the trigger button (e.g. at the imported-wallet cap). */
  readonly disabled?: boolean
}

/** Return shape of the `useImportKeySheet` smart hook (ADR-0076 D-6). */
export interface ImportKeySheetView {
  /** Whether the secret-entry Modal is open. */
  readonly isOpen: boolean
  /** The controlled (masked) private-key input value. */
  readonly keyInput: string
  /** `true` once the input matches a 32-byte hex key (`^(0x)?[0-9a-fA-F]{64}$`). */
  readonly isValid: boolean
  /** `true` while the Privy import → server persist round-trip is in flight. */
  readonly isSubmitting: boolean
  /** Inline error copy for a failed import, else `null`. Never contains the key. */
  readonly error: string | null
  /** Opens the sheet (input starts empty). */
  open(): void
  /** Closes the sheet and clears the key from state. */
  close(): void
  /** Updates the controlled key input. */
  setKeyInput(next: string): void
  /** Imports the key into Privy, persists the wallet, refreshes the list, closes. */
  onSubmit(): void
}
