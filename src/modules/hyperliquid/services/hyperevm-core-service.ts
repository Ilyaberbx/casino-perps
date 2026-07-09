import { errAsync, ResultAsync } from 'neverthrow'
import {
  erc20Abi,
  formatUnits,
  UserRejectedRequestError,
  type Account,
  type Chain,
  type PublicClient,
  type WalletClient,
} from 'viem'
import type { WalletAddress } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import { formatAddress } from '@/modules/shared/logger'
import { HYPE_EVM_DECIMALS } from './hyperevm.constants'
import {
  HyperEvmCoreError,
  type Erc20TransferRequest,
  type HyperEvmCoreService,
  type HyperEvmTransferReceipt,
  type NativeHypeTransferRequest,
} from './hyperevm-core-service.types'

export interface CreateHyperEvmCoreServiceOptions {
  /** Reads HyperEVM chain state (balances, receipts). Public, no signing. */
  readonly publicClient: PublicClient
  /** The HyperEVM viem chain — passed per-call to writeContract/sendTransaction. */
  readonly chain: Chain
  readonly logger: Logger
}

/**
 * viem-only HyperEVM core service (ADR-0069 / ADR-0028 D-4). Owns the EVM→Core
 * on-chain writes — `ERC20.transfer(systemAddress, raw)` and the native HYPE
 * value transfer to `0x2222…2222` — plus the chain read/switch capability and the
 * EVM balance reads. It NEVER imports `@nktkas/hyperliquid` (standard EVM writes
 * that target HL system addresses), so it stays out of the four-file SDK lint
 * zone. The broadcast wallet is Arbitrum-bound by default (`account/`), so every
 * write switches the wallet to HyperEVM first and passes `chain` explicitly. Every
 * fallible call is wrapped at the viem boundary; no `try/catch` escapes this file.
 */
export function createHyperEvmCoreService(
  options: CreateHyperEvmCoreServiceOptions,
): HyperEvmCoreService {
  const log = options.logger.child({ module: 'hyperevm-core-service' })
  const publicClient = options.publicClient
  const chain = options.chain

  const readNativeBalance = (
    address: WalletAddress,
  ): ResultAsync<number, HyperEvmCoreError> =>
    ResultAsync.fromPromise(
      publicClient.getBalance({ address }),
      (cause) => new HyperEvmCoreError('balance-read-failed', 'getBalance failed', cause),
    ).map((raw) => {
      const hype = Number(formatUnits(raw, HYPE_EVM_DECIMALS))
      log.debug({ address: formatAddress(address), hype }, 'native balance')
      return hype
    })

  const readErc20Balance = (
    contract: `0x${string}`,
    address: WalletAddress,
    decimals: number,
  ): ResultAsync<number, HyperEvmCoreError> =>
    ResultAsync.fromPromise(
      publicClient.readContract({
        address: contract,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      }),
      (cause) => new HyperEvmCoreError('balance-read-failed', 'balanceOf failed', cause),
    ).map((raw) => Number(formatUnits(raw, decimals)))

  const readChainId = (wallet: WalletClient): ResultAsync<number, HyperEvmCoreError> =>
    ResultAsync.fromPromise(
      wallet.getChainId(),
      (cause) => new HyperEvmCoreError('unknown', 'getChainId failed', cause),
    )

  const transferErc20 = (
    wallet: WalletClient,
    request: Erc20TransferRequest,
  ): ResultAsync<HyperEvmTransferReceipt, HyperEvmCoreError> => {
    const account = wallet.account
    if (account === undefined) {
      return errAsync(
        new HyperEvmCoreError('wallet-unavailable', 'WalletClient has no account'),
      )
    }
    return broadcastErc20(wallet, account, chain, request).andThen((hash) =>
      waitForReceipt(publicClient, hash).map(() => {
        log.debug({ transactionHash: hash }, 'receipt mined')
        return { transactionHash: hash }
      }),
    )
  }

  const sendNativeHype = (
    wallet: WalletClient,
    request: NativeHypeTransferRequest,
  ): ResultAsync<HyperEvmTransferReceipt, HyperEvmCoreError> => {
    const account = wallet.account
    if (account === undefined) {
      return errAsync(
        new HyperEvmCoreError('wallet-unavailable', 'WalletClient has no account'),
      )
    }
    return broadcastNative(wallet, account, chain, request).andThen((hash) =>
      waitForReceipt(publicClient, hash).map(() => {
        log.debug({ transactionHash: hash }, 'receipt mined')
        return { transactionHash: hash }
      }),
    )
  }

  return {
    readNativeBalance,
    readErc20Balance,
    readChainId,
    transferErc20,
    sendNativeHype,
  }
}

function broadcastErc20(
  wallet: WalletClient,
  account: Account,
  chain: Chain,
  request: Erc20TransferRequest,
): ResultAsync<`0x${string}`, HyperEvmCoreError> {
  return ResultAsync.fromPromise(
    wallet.writeContract({
      account,
      chain,
      address: request.contract,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [request.systemAddress, request.rawAmount],
    }),
    (cause) => mapWalletError(cause, 'transfer-failed', 'ERC20 transfer failed'),
  )
}

function broadcastNative(
  wallet: WalletClient,
  account: Account,
  chain: Chain,
  request: NativeHypeTransferRequest,
): ResultAsync<`0x${string}`, HyperEvmCoreError> {
  return ResultAsync.fromPromise(
    wallet.sendTransaction({
      account,
      chain,
      to: request.to,
      value: request.weiAmount,
    }),
    (cause) => mapWalletError(cause, 'transfer-failed', 'native HYPE transfer failed'),
  )
}

function waitForReceipt(
  publicClient: PublicClient,
  hash: `0x${string}`,
): ResultAsync<unknown, HyperEvmCoreError> {
  return ResultAsync.fromPromise(
    publicClient.waitForTransactionReceipt({ hash }),
    (cause) =>
      new HyperEvmCoreError('transfer-failed', 'waitForTransactionReceipt failed', cause),
  )
}

/**
 * Classify a viem-thrown error. A user-rejected wallet prompt maps to
 * `wallet-rejected` so the state machine returns non-destructively to the prior
 * state (amount preserved); everything else maps to the supplied fallback kind.
 */
function mapWalletError(
  cause: unknown,
  fallback: 'chain-switch-failed' | 'transfer-failed',
  message: string,
): HyperEvmCoreError {
  const isRejection = cause instanceof UserRejectedRequestError
  if (isRejection) return new HyperEvmCoreError('wallet-rejected', message, cause)
  return new HyperEvmCoreError(fallback, message, cause)
}
