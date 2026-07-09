import type { ResultAsync } from 'neverthrow'
import type { Unsubscribe } from '../domain.types'
import type { PortfolioHistoryFetchError } from '../portfolio'

/**
 * Discriminated union mirroring the per-record `delta` field of the
 * Hyperliquid `userNonFundingLedgerUpdates` response, literal-for-literal.
 * The SDK type re-export is the source of truth — a static type-equivalence
 * check inside the reader (`hyperliquid/services/account-activity-reader.ts`)
 * fails typecheck if the two diverge, so the renderer's exhaustive
 * `never`-narrowed default branch can never silently encounter a new SDK
 * kind. Stringified-number fields are kept as-is and parsed at render time.
 */
export type AccountActivityDelta =
  | { readonly type: 'accountClassTransfer'; readonly usdc: string; readonly toPerp: boolean }
  | { readonly type: 'deposit'; readonly usdc: string }
  | {
      readonly type: 'internalTransfer'
      readonly usdc: string
      readonly user: `0x${string}`
      readonly destination: `0x${string}`
      readonly fee: string
    }
  | {
      readonly type: 'liquidation'
      readonly liquidatedNtlPos: string
      readonly accountValue: string
      readonly leverageType: 'Cross' | 'Isolated'
      readonly liquidatedPositions: { coin: string; szi: string }[]
    }
  | { readonly type: 'rewardsClaim'; readonly amount: string; readonly token: string }
  | {
      readonly type: 'spotTransfer'
      readonly token: string
      readonly amount: string
      readonly usdcValue: string
      readonly user: `0x${string}`
      readonly destination: `0x${string}`
      readonly fee: string
      readonly nativeTokenFee: string
      readonly nonce: number | null
      readonly feeToken: string
    }
  | {
      readonly type: 'subAccountTransfer'
      readonly usdc: string
      readonly user: `0x${string}`
      readonly destination: `0x${string}`
    }
  | { readonly type: 'vaultCreate'; readonly vault: `0x${string}`; readonly usdc: string; readonly fee: string }
  | { readonly type: 'vaultDeposit'; readonly vault: `0x${string}`; readonly usdc: string }
  | { readonly type: 'vaultDistribution'; readonly vault: `0x${string}`; readonly usdc: string }
  | {
      readonly type: 'vaultWithdraw'
      readonly vault: `0x${string}`
      readonly user: `0x${string}`
      readonly requestedUsd: string
      readonly commission: string
      readonly closingCost: string
      readonly basis: string
      readonly netWithdrawnUsd: string
    }
  | { readonly type: 'withdraw'; readonly usdc: string; readonly nonce: number; readonly fee: string }
  | {
      readonly type: 'send'
      readonly user: `0x${string}`
      readonly destination: `0x${string}`
      readonly sourceDex: string
      readonly destinationDex: string
      readonly token: string
      readonly amount: string
      readonly usdcValue: string
      readonly fee: string
      readonly nativeTokenFee: string
      readonly nonce: number
      readonly feeToken: string
    }
  | { readonly type: 'deployGasAuction'; readonly token: string; readonly amount: string }
  | {
      readonly type: 'cStakingTransfer'
      readonly token: string
      readonly amount: string
      readonly isDeposit: boolean
    }
  | {
      readonly type: 'borrowLend'
      readonly token: string
      readonly operation: 'supply' | 'withdraw' | 'repay' | 'borrow'
      readonly amount: string
      readonly interestAmount: string
    }
  | { readonly type: 'spotGenesis'; readonly token: string; readonly amount: string }
  | {
      readonly type: 'activateDexAbstraction'
      readonly dex: string
      readonly token: string
      readonly amount: string
    }
  | { readonly type: 'vaultLeaderCommission'; readonly user: `0x${string}`; readonly usdc: string }

export type AccountActivityDeltaKind = AccountActivityDelta['type']

export interface AccountActivityEntry {
  readonly time: number
  readonly hash: string
  readonly delta: AccountActivityDelta
}

/**
 * History port for the Portfolio "Account Activity" tab. Backed by the
 * Hyperliquid `userNonFundingLedgerUpdates({ user, startTime, endTime })`
 * info endpoint — fetched as one full-history window (`startTime: 0`) and
 * ordered newest-first client-side (ADR-0034, superseding the 30-day backward
 * window scan of ADR-0023). Captures deposits, withdrawals,
 * transfers, vault activity, liquidations, staking, borrow/lend, and other
 * non-funding ledger events; each entry's `delta` is the full discriminated
 * SDK shape so the renderer can dispatch exhaustively.
 */
export interface AccountActivityReader {
  subscribe(
    onUpdate: (entries: ReadonlyArray<AccountActivityEntry>) => void,
  ): Unsubscribe
  loadOlder(): ResultAsync<{ exhausted: boolean }, PortfolioHistoryFetchError>
}
