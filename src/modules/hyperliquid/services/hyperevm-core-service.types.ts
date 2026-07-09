import type { ResultAsync } from 'neverthrow'
import type { WalletClient } from 'viem'
import type { WalletAddress } from '@/modules/shared/domain'

/**
 * The discriminated failure surface of the HyperEVM core service. Every fallible
 * method returns a `ResultAsync<_, HyperEvmCoreError>`; the EVM→Core flow maps
 * each `kind` to a user-facing reason. `wallet-rejected` is non-destructive (the
 * machine returns to the prior state with the amount preserved).
 */
export type HyperEvmCoreErrorKind =
  | 'wallet-unavailable'
  | 'wallet-rejected'
  | 'chain-switch-failed'
  | 'transfer-failed'
  | 'balance-read-failed'
  | 'unknown'

export class HyperEvmCoreError extends Error {
  readonly kind: HyperEvmCoreErrorKind
  constructor(kind: HyperEvmCoreErrorKind, message: string, cause?: unknown) {
    super(message)
    this.kind = kind
    this.cause = cause
    this.name = 'HyperEvmCoreError'
  }
}

/** A mined HyperEVM transfer — EVM→Core phase-1 success (the token left the EVM wallet). */
export interface HyperEvmTransferReceipt {
  readonly transactionHash: `0x${string}`
}

/** Inputs for an ERC20 → system-address transfer (EVM→Core, non-HYPE tokens). */
export interface Erc20TransferRequest {
  /** The token's HyperEVM ERC20 contract address. */
  readonly contract: `0x${string}`
  /** The token's system address (index-derived) — credits the user's HyperCore balance. */
  readonly systemAddress: WalletAddress
  /** The amount in the token's smallest EVM unit (already scaled + floored). */
  readonly rawAmount: bigint
}

/** Inputs for a native HYPE value transfer (EVM→Core, HYPE only). */
export interface NativeHypeTransferRequest {
  /** Always `HYPE_SYSTEM_ADDRESS` (`0x2222…2222`). */
  readonly to: WalletAddress
  /** The amount in wei (18 decimals, already scaled + floored). */
  readonly weiAmount: bigint
}

/**
 * Public surface of the HyperEVM core service. viem-only — it NEVER imports
 * `@nktkas/hyperliquid` and never enters the four-file SDK lint zone (ADR-0069 /
 * ADR-0028 D-4). The broadcast `WalletClient` is supplied by `account/`'s
 * `getBroadcastWalletClient` (Arbitrum-bound by default); this service reads the
 * chain and broadcasts with a per-call chain override. The chain SWITCH itself is
 * `account/`'s Privy-native `switchMasterWalletChain` (ADR-0080), not here — the
 * old viem `switchToHyperEvm` no-op'd for the embedded wallet.
 */
export interface HyperEvmCoreService {
  /** Read the wallet's native HYPE balance (whole units) — the gas check source. */
  readNativeBalance(address: WalletAddress): ResultAsync<number, HyperEvmCoreError>
  /** Read an ERC20 token balance (whole units) at the given EVM `decimals`. */
  readErc20Balance(
    contract: `0x${string}`,
    address: WalletAddress,
    decimals: number,
  ): ResultAsync<number, HyperEvmCoreError>
  /** Read the connected wallet's current chain id (the wrong-chain preflight + post-switch verify). */
  readChainId(wallet: WalletClient): ResultAsync<number, HyperEvmCoreError>
  /** Broadcast `ERC20.transfer(systemAddress, rawAmount)` on HyperEVM and await the receipt. */
  transferErc20(
    wallet: WalletClient,
    request: Erc20TransferRequest,
  ): ResultAsync<HyperEvmTransferReceipt, HyperEvmCoreError>
  /** Broadcast a native HYPE value transfer to `0x2222…2222` and await the receipt. */
  sendNativeHype(
    wallet: WalletClient,
    request: NativeHypeTransferRequest,
  ): ResultAsync<HyperEvmTransferReceipt, HyperEvmCoreError>
}
