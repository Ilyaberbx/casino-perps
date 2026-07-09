/**
 * Flattened, render-ready projection of one account-activity ledger delta —
 * one field per column of the Account Activity tab
 * (Time · Status · Asset · Action · From · To · Destination · Account Change ·
 * USD Value · Fee). `Time` and `Status` are not projected here: `Time` comes
 * from the entry timestamp and `Status` is constant ("Completed") for settled
 * ledger events.
 */
export interface AccountActivityRow {
  /**
   * The delta `type`. Widened to `string` (not `AccountActivityDelta['type']`)
   * so the unknown-kind fallback can carry a live-API kind the pinned SDK type
   * doesn't model yet — see `renderUnknownDelta` in `account-activity-delta.ts`.
   */
  readonly kind: string
  /** Human action label — the "Action" column (e.g. "Deposit", "Vault Deposit"). */
  readonly action: string
  /** Asset symbol moved — the "Asset" column (e.g. "USDC", "HYPE"). `--` when none. */
  readonly asset: string
  /** Source zone/account — the "From" column (e.g. "Arbitrum", "Perps"). Null → `--`. */
  readonly from: string | null
  /** Destination zone/account or known vault name — the "To" column. Null → `--`. */
  readonly to: string | null
  /** Counterparty/vault address, already truncated — the "Destination" column. Null → `--`. */
  readonly destination: string | null
  /** Signed token delta applied to the account — the "Account Change" column. Null → `--`. */
  readonly changeAmount: number | null
  /** Asset symbol the change is denominated in (usually equals `asset`). */
  readonly changeAsset: string
  /** Unsigned USD value of the event — the "USD Value" column. Null → `--`. */
  readonly usdValue: number | null
  /** Fee paid, already formatted with its asset (e.g. "1 USDC") — the "Fee" column. Null → `--`. */
  readonly fee: string | null
}
