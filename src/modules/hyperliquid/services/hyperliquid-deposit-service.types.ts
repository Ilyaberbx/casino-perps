import type { ResultAsync } from 'neverthrow'
import type { WalletClient } from 'viem'
import type { WalletAddress } from '@/modules/shared/domain'

/**
 * The discriminated failure surface of the HL deposit service. Every fallible
 * method returns a `ResultAsync<_, HyperliquidDepositError>`; the state machine
 * maps each `kind` to a user-facing reason. `transfer-failed` is only reachable
 * pre-broadcast (an accepted-then-mined transfer reaches `sent`, never this).
 */
export type HyperliquidDepositErrorKind =
  | 'wallet-unavailable'
  | 'wallet-rejected'
  | 'chain-switch-failed'
  | 'transfer-failed'
  | 'balance-read-failed'
  | 'unknown'

export class HyperliquidDepositError extends Error {
  readonly kind: HyperliquidDepositErrorKind
  constructor(kind: HyperliquidDepositErrorKind, message: string, cause?: unknown) {
    super(message)
    this.kind = kind
    this.cause = cause
    this.name = 'HyperliquidDepositError'
  }
}

/** A wallet's on-chain liquidity snapshot, read at the viem boundary. */
export interface DepositWalletBalances {
  /** USDC balance in whole units (6-decimal raw divided by 10^6). */
  readonly usdc: number
  /** Native ETH-for-gas balance in whole units (wei divided by 10^18). */
  readonly ethForGas: number
}

/** A mined Arbitrum transfer — phase-1 success (money left the wallet). */
export interface DepositTransferReceipt {
  readonly transactionHash: `0x${string}`
}

/**
 * Public surface of the HL deposit service. viem-only — it NEVER imports
 * `@nktkas/hyperliquid` and never enters the four-file SDK lint zone (ADR-0028
 * D-4). The broadcast `WalletClient` is supplied by `account/`'s
 * `getBroadcastWalletClient` (ADR-0028 D-1); the public client reads chain
 * state. The chain SWITCH is `account/`'s Privy-native `switchMasterWalletChain`
 * (ADR-0080), not here — the old viem `switchToArbitrum` no-op'd for the embedded
 * wallet. This service exposes the read + transfer capabilities only; switch
 * POLICY lives in the state machine.
 */
export interface HyperliquidDepositService {
  /** Read wallet USDC + ETH-for-gas balances for `address`. */
  readBalances(
    address: WalletAddress,
  ): ResultAsync<DepositWalletBalances, HyperliquidDepositError>
  /** Read the connected wallet's current chain id (the wrong-chain preflight + post-switch verify). */
  readChainId(wallet: WalletClient): ResultAsync<number, HyperliquidDepositError>
  /**
   * Execute `USDC.transfer(BRIDGE2, amount)` on Arbitrum and await the receipt.
   * `amountUsdc` is in whole USDC units; the service scales to 6 decimals.
   * Resolves only once the transfer is mined (phase-1 success).
   */
  transfer(
    wallet: WalletClient,
    amountUsdc: number,
  ): ResultAsync<DepositTransferReceipt, HyperliquidDepositError>
}
