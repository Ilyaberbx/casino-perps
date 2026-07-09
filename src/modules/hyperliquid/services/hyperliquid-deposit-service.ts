import { errAsync, ResultAsync } from 'neverthrow'
import {
  erc20Abi,
  formatUnits,
  parseUnits,
  UserRejectedRequestError,
  type Account,
  type Chain,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { arbitrum } from 'viem/chains'
import type { WalletAddress } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import { formatAddress } from '@/modules/shared/logger'
import {
  ARBITRUM_USDC_ADDRESS,
  HYPERLIQUID_BRIDGE2_ADDRESS,
  USDC_DECIMALS,
} from './hyperliquid-deposit.constants'
import {
  HyperliquidDepositError,
  type DepositTransferReceipt,
  type DepositWalletBalances,
  type HyperliquidDepositService,
} from './hyperliquid-deposit-service.types'

const ETH_DECIMALS = 18

export interface CreateHyperliquidDepositServiceOptions {
  /** Reads Arbitrum chain state (balances, receipts). Public, no signing. */
  readonly publicClient: PublicClient
  readonly logger: Logger
}

/**
 * viem-only HL deposit service (ADR-0028 D-4). Owns the generic EVM
 * `USDC.transfer(BRIDGE2, amount)` write, the chain read/switch capability, and
 * the wallet balance reads. It NEVER imports `@nktkas/hyperliquid` — the
 * transfer is a standard ERC-20 write that happens to target an HL-owned
 * address, so it stays out of the four-file SDK lint zone. Every fallible call
 * is wrapped at the viem boundary into a typed `HyperliquidDepositError`; no
 * `try/catch` escapes this file.
 */
export function createHyperliquidDepositService(
  options: CreateHyperliquidDepositServiceOptions,
): HyperliquidDepositService {
  const log = options.logger.child({ module: 'hyperliquid-deposit-service' })
  const publicClient = options.publicClient

  const readBalances = (
    address: WalletAddress,
  ): ResultAsync<DepositWalletBalances, HyperliquidDepositError> => {
    const usdcRead = ResultAsync.fromPromise(
      publicClient.readContract({
        address: ARBITRUM_USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      }),
      (cause) =>
        new HyperliquidDepositError('balance-read-failed', 'USDC balanceOf failed', cause),
    )
    const ethRead = ResultAsync.fromPromise(
      publicClient.getBalance({ address }),
      (cause) =>
        new HyperliquidDepositError('balance-read-failed', 'getBalance failed', cause),
    )
    return ResultAsync.combine([usdcRead, ethRead]).map(([usdcRaw, ethRaw]) => {
      const usdc = Number(formatUnits(usdcRaw, USDC_DECIMALS))
      const ethForGas = Number(formatUnits(ethRaw, ETH_DECIMALS))
      log.debug({ address: formatAddress(address), usdc, ethForGas }, 'balances')
      return { usdc, ethForGas }
    })
  }

  const readChainId = (
    wallet: WalletClient,
  ): ResultAsync<number, HyperliquidDepositError> =>
    ResultAsync.fromPromise(
      wallet.getChainId(),
      (cause) => new HyperliquidDepositError('unknown', 'getChainId failed', cause),
    )

  const transfer = (
    wallet: WalletClient,
    amountUsdc: number,
  ): ResultAsync<DepositTransferReceipt, HyperliquidDepositError> => {
    const account = wallet.account
    if (account === undefined) {
      return errAsync(
        new HyperliquidDepositError('wallet-unavailable', 'WalletClient has no account'),
      )
    }
    const amountRaw = parseUnits(amountUsdc.toString(), USDC_DECIMALS)
    return broadcastTransfer(wallet, account, amountRaw).andThen((hash) =>
      waitForReceipt(publicClient, hash).map(() => {
        // Boundary trace only — the flow owns the `info` `transfer sent` line
        // (with depositId) on the `ok` path; logging here too would double-log.
        log.debug({ transactionHash: hash }, 'receipt mined')
        return { transactionHash: hash }
      }),
    )
  }

  return { readBalances, readChainId, transfer }
}

function broadcastTransfer(
  wallet: WalletClient,
  account: Account,
  amountRaw: bigint,
): ResultAsync<`0x${string}`, HyperliquidDepositError> {
  // viem's WalletClient.writeContract requires a `chain`; the broadcast client
  // is built bound to Arbitrum (ADR-0028), so we pass it explicitly to satisfy
  // the type without re-reading it from the wallet.
  const chain: Chain = arbitrum
  return ResultAsync.fromPromise(
    wallet.writeContract({
      account,
      chain,
      address: ARBITRUM_USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [HYPERLIQUID_BRIDGE2_ADDRESS, amountRaw],
    }),
    (cause) => mapWalletError(cause, 'transfer-failed', 'USDC transfer failed'),
  )
}

function waitForReceipt(
  publicClient: PublicClient,
  hash: `0x${string}`,
): ResultAsync<unknown, HyperliquidDepositError> {
  return ResultAsync.fromPromise(
    publicClient.waitForTransactionReceipt({ hash }),
    (cause) =>
      new HyperliquidDepositError('transfer-failed', 'waitForTransactionReceipt failed', cause),
  )
}

/**
 * Classify a viem-thrown error. A user-rejected wallet prompt maps to
 * `wallet-rejected` so the state machine can return non-destructively to the
 * prior state (amount preserved); everything else maps to the supplied
 * fallback kind.
 */
function mapWalletError(
  cause: unknown,
  fallback: 'chain-switch-failed' | 'transfer-failed',
  message: string,
): HyperliquidDepositError {
  const isRejection = cause instanceof UserRejectedRequestError
  if (isRejection) return new HyperliquidDepositError('wallet-rejected', message, cause)
  return new HyperliquidDepositError(fallback, message, cause)
}
