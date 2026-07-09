import type { KeyboardEvent, RefObject } from 'react'

/**
 * Wallet provenance, kept structural (not imported from `account/`) so this
 * shared component takes no feature-layer dependency. Matches `account`'s
 * `WalletSource` by shape, so an `account` `Wallet[]` is assignable to
 * `RecipientWallet[]`.
 */
export type RecipientWalletSource = 'embedded' | 'external' | 'imported'

/** The minimal wallet shape the suggestion builder needs. */
export interface RecipientWallet {
  readonly address: string
  readonly source: RecipientWalletSource
}

/**
 * A recipient the combobox can suggest — one of the user's own wallets or an
 * address they recently sent to. `title` is the primary display line (`Native`
 * for the embedded wallet, else the truncated checksummed address); `subtitle` is
 * the secondary line (the wallet source, or `null` for a recent address).
 * `address` is the raw value written into the field on select.
 */
export interface RecipientSuggestion {
  readonly address: string
  readonly title: string
  readonly subtitle: string | null
}

/**
 * A single suggestion row. Extends the raw suggestion with the flat-list `index`
 * + stable `id` (for `aria-activedescendant`) and whether it is the keyboard-active
 * row. Groups render separately but share one flat index space so the arrow-key
 * cursor moves across both.
 */
export interface RecipientOption extends RecipientSuggestion {
  readonly id: string
  readonly index: number
  readonly isActive: boolean
}

/** A titled group of suggestion rows (`Your wallets` / `Recent`). */
export interface RecipientGroup {
  readonly heading: string
  readonly options: ReadonlyArray<RecipientOption>
}

/** Inputs a host's smart hook feeds the recipient-combobox hook. */
export interface UseRecipientComboboxParams {
  /** The controlled recipient string. */
  readonly value: string
  readonly walletSuggestions: ReadonlyArray<RecipientSuggestion>
  readonly recentSuggestions: ReadonlyArray<RecipientSuggestion>
  /** Write the recipient value. */
  onChange(next: string): void
  /** Static presentational config threaded through to the view. */
  readonly inputId: string
  readonly label: string
  /** Optional secondary label text (e.g. Withdraw's "(your wallet)"), else `null`. */
  readonly hint: string | null
  readonly ariaLabel: string
  readonly placeholder: string
  /** `true` to apply the invalid input skin + `aria-invalid`. */
  readonly isInvalid: boolean
  /** Inline invalid message under the input, or `null` for none. */
  readonly invalidReason: string | null
}

/** The view the dumb `RecipientCombobox` widget renders. */
export interface RecipientComboboxView {
  readonly value: string
  readonly inputId: string
  readonly label: string
  readonly hint: string | null
  readonly ariaLabel: string
  readonly placeholder: string
  readonly isInvalid: boolean
  readonly invalidReason: string | null
  /** `true` when the suggestion panel is open (folds in "has any suggestion"). */
  readonly isOpen: boolean
  /** `true` when there is at least one suggestion to offer (drives the caret). */
  readonly hasSuggestions: boolean
  readonly groups: ReadonlyArray<RecipientGroup>
  /** The id of the active option for `aria-activedescendant`, or `null`. */
  readonly activeOptionId: string | null
  readonly anchorRef: RefObject<HTMLDivElement | null>
  readonly panelRef: RefObject<HTMLDivElement | null>
  onInputChange(next: string): void
  onFocus(): void
  onToggle(): void
  onKeyDown(event: KeyboardEvent<HTMLInputElement>): void
  onSelect(address: string): void
}
