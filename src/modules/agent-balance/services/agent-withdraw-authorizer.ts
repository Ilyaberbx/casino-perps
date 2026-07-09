import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import {
  BaseError,
  ChainMismatchError,
  ContractFunctionRevertedError,
  InsufficientFundsError,
  UserRejectedRequestError,
  WaitForTransactionReceiptTimeoutError,
} from 'viem'
import { base } from 'viem/chains'
import { scrubAddresses } from '@/modules/shared/logger'
import { BASE_USDC_ADDRESS, ERC20_TRANSFER_ABI } from '../agent-balance.constants'
import { toUsdcBaseUnits } from '../agent-balance.utils'
import {
  BaseUsdcTransferError,
  type AgentWalletAddress,
  type AgentWithdrawAuthorizer,
  type BaseUsdcTransferReceipt,
} from '../agent-balance.types'
import type {
  BaseReceiptClient,
  BaseTransferWalletClient,
} from './base-usdc-transfer.types'

export interface CreateAgentWithdrawAuthorizerOptions {
  /**
   * Prompts the User for a FRESH, EXPLICIT per-action authorization and, on
   * approval, resolves a per-action signing client for THIS withdrawal. It is
   * categorically NOT the standing, popup-free delegated signer (which is scoped
   * to Minara x402 + CCTP and only reaches known recipients) — ADR-0046 D-7. A
   * declined prompt resolves `null`, which the authorizer maps to
   * `wallet-rejected`.
   */
  readonly requestExplicitAuthorization: () => Promise<BaseTransferWalletClient | null>
  /** Reads chain state to await the transfer receipt. */
  readonly publicClient: BaseReceiptClient
}

/**
 * WITHDRAW authorizer (issue #211): sends USDC OUT of the Agent Wallet to a
 * user-specified Base address via an EXPLICIT per-action authorization — a fresh
 * signature the User approves for this single withdrawal. The standing
 * delegation is never an input here; this service has no reference to a
 * delegated signer, so a funds-to-anywhere transfer can never be folded into it.
 * viem-only; every fallible call is wrapped into a typed `BaseUsdcTransferError`.
 */
export function createAgentWithdrawAuthorizer(
  options: CreateAgentWithdrawAuthorizerOptions,
): AgentWithdrawAuthorizer {
  const { requestExplicitAuthorization, publicClient } = options

  const authorizeAndSend = (
    destination: AgentWalletAddress,
    amountUsdc: number,
  ): ResultAsync<BaseUsdcTransferReceipt, BaseUsdcTransferError> => {
    const amountRaw = toUsdcBaseUnits(amountUsdc)
    return resolveExplicitWallet(requestExplicitAuthorization).andThen((wallet) => {
      const account = wallet.account
      if (account === undefined) {
        return errAsync(
          new BaseUsdcTransferError('wallet-unavailable', 'authorized wallet has no account'),
        )
      }
      return broadcastTransfer(wallet, account, destination, amountRaw).andThen((hash) =>
        awaitReceipt(publicClient, hash),
      )
    })
  }

  return { authorizeAndSend }
}

/**
 * Run the explicit-authorization prompt. A `null` result means the User
 * declined — surfaced as `wallet-rejected`, the same non-destructive return the
 * cancel-mid-signature path uses.
 */
function resolveExplicitWallet(
  requestExplicitAuthorization: () => Promise<BaseTransferWalletClient | null>,
): ResultAsync<BaseTransferWalletClient, BaseUsdcTransferError> {
  return ResultAsync.fromPromise(
    requestExplicitAuthorization(),
    (cause) => mapTransferError(cause),
  ).andThen((wallet) => {
    if (wallet === null) {
      return errAsync(
        new BaseUsdcTransferError('wallet-rejected', 'explicit authorization declined'),
      )
    }
    return ResultAsync.fromSafePromise(Promise.resolve(wallet))
  })
}

function broadcastTransfer(
  wallet: BaseTransferWalletClient,
  account: { readonly address: AgentWalletAddress },
  to: AgentWalletAddress,
  amountRaw: bigint,
): ResultAsync<`0x${string}`, BaseUsdcTransferError> {
  return ResultAsync.fromPromise(
    wallet.writeContract({
      account,
      chain: base,
      address: BASE_USDC_ADDRESS,
      abi: ERC20_TRANSFER_ABI,
      functionName: 'transfer',
      args: [to, amountRaw],
    }),
    (cause) => mapTransferError(cause),
  )
}

/**
 * Await the mined receipt for `hash`. A rejected wait (e.g. the poll timing
 * out) is classified through `mapTransferError` like any other failure — a
 * timeout is not a send failure (`receipt-timeout`), so it must not be forced
 * into `transfer-failed`. A resolved-but-reverted receipt is a real on-chain
 * failure (`insufficient-balance`) and must never be reported as a successful
 * send.
 */
function awaitReceipt(
  publicClient: BaseReceiptClient,
  hash: `0x${string}`,
): ResultAsync<BaseUsdcTransferReceipt, BaseUsdcTransferError> {
  return ResultAsync.fromPromise(
    publicClient.waitForTransactionReceipt({ hash }),
    (cause) => mapTransferError(cause),
  ).andThen((receipt) => {
    const isReverted = receipt.status === 'reverted'
    if (isReverted) {
      return errAsync(
        new BaseUsdcTransferError('insufficient-balance', 'transfer mined but reverted on-chain'),
      )
    }
    return okAsync({ transactionHash: hash })
  })
}

/**
 * Classify a viem-thrown transfer error into a `BaseUsdcTransferError`, most
 * specific cause first. Order matters: a user-rejected prompt is the
 * highest-confidence signal (checked before anything else so it never falls
 * through to a generic bucket), followed by the deterministic RPC-rejection
 * causes (wrong chain, no ETH for gas), then the decode-dependent on-chain
 * revert, then the receipt-specific timeout. Anything unrecognized is the
 * residual `transfer-failed` (a viem `BaseError` we don't special-case, or a
 * plain `Error`) or `unknown` (a non-`Error` throw). The message is scrubbed
 * here — this function is the address-scrub boundary for the module, so
 * downstream logging never has to re-scrub.
 */
export function mapTransferError(cause: unknown): BaseUsdcTransferError {
  const isViemError = cause instanceof BaseError
  if (isViemError) return classifyViemError(cause)

  const isPlainError = cause instanceof Error
  if (isPlainError) return new BaseUsdcTransferError('transfer-failed', describeCause(cause), cause)

  return new BaseUsdcTransferError('unknown', describeCause(cause), cause)
}

function classifyViemError(cause: BaseError): BaseUsdcTransferError {
  const isRejection = cause.walk((err) => err instanceof UserRejectedRequestError) !== null
  if (isRejection) return new BaseUsdcTransferError('wallet-rejected', 'user rejected transfer', cause)

  const isWrongNetwork = cause.walk((err) => err instanceof ChainMismatchError) !== null
  if (isWrongNetwork) return new BaseUsdcTransferError('wrong-network', describeCause(cause), cause)

  const isInsufficientGas = cause.walk((err) => err instanceof InsufficientFundsError) !== null
  if (isInsufficientGas) return new BaseUsdcTransferError('insufficient-gas', describeCause(cause), cause)

  const reverted = cause.walk((err) => err instanceof ContractFunctionRevertedError)
  const isReverted = reverted instanceof ContractFunctionRevertedError
  if (isReverted) return new BaseUsdcTransferError('insufficient-balance', describeCause(reverted), cause)

  const isReceiptTimeout =
    cause.walk((err) => err instanceof WaitForTransactionReceiptTimeoutError) !== null
  if (isReceiptTimeout) return new BaseUsdcTransferError('receipt-timeout', describeCause(cause), cause)

  return new BaseUsdcTransferError('transfer-failed', describeCause(cause), cause)
}

/** Scrub a thrown cause's message so it is safe to log or store on the error. */
function describeCause(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause)
  return scrubAddresses(message)
}
