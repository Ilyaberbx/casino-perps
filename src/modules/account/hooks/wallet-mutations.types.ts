/**
 * Shared select/import/remove surface over the user's wallets, reconciled
 * through the canonical `Me` cache (`applyMe`). Consumed by the Account Modal's
 * Wallets section and the header Quick-Wallet Switcher so the two never diverge
 * from the server `is_selected`.
 */
export interface WalletMutationsView {
  /** The Selected Wallet address — optimistic overlay on the server `is_selected`. */
  readonly selectedAddress: string | null
  /** Number of **imported** (`external`) wallets — Native + Agent excluded. */
  readonly importedCount: number
  /** `true` at the imported-wallet cap — the Import affordance is disabled. */
  readonly isImportAtCap: boolean
  /** A short cap hint, e.g. `3/3 imported`, shown next to a disabled Import button. */
  readonly importHint: string
  /** `true` while a link→import round-trip is in flight. */
  readonly isImporting: boolean
  /** Optimistic select → `POST /api/account/wallets/:address/select` → `applyMe`. */
  onSelect(address: string): void
  /** Privy `linkWallet` → `POST /api/account/wallets/import` → `applyMe`. */
  onImport(): void
  /** `DELETE /api/account/wallets/:address` → `applyMe` (imported-only). */
  onRemove(address: string): void
}
