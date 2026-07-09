import { base } from 'viem/chains'
import {
  ChainMismatchError,
  ContractFunctionRevertedError,
  InsufficientFundsError,
  UserRejectedRequestError,
  WaitForTransactionReceiptTimeoutError,
} from 'viem'
import { ERC20_TRANSFER_ABI } from '../../agent-balance.constants'
import type { AgentWalletAddress } from '../../agent-balance.types'
import type {
  BaseReceiptClient,
  BaseTransferWalletClient,
} from '../base-usdc-transfer.types'

const ACCOUNT_ADDRESS =
  '0x1111111111111111111111111111111111111111' as AgentWalletAddress
const SENT_HASH =
  '0xabc0000000000000000000000000000000000000000000000000000000000abc' as const

/** Records every `writeContract` the service issues, for assertions. */
export interface RecordedTransfer {
  readonly to: AgentWalletAddress
  readonly amount: bigint
}

export interface FakeWalletClientResult {
  readonly client: BaseTransferWalletClient
  readonly transfers: RecordedTransfer[]
}

export interface FakeWalletClientOptions {
  /** Chain id the wallet reports (default Base 8453). */
  readonly chainId?: number
  /** When set, `writeContract` rejects with this — e.g. a user rejection. */
  readonly rejectWith?: unknown
  /** Drop the account so the service surfaces `wallet-unavailable`. */
  readonly noAccount?: boolean
}

/** A fake Base wallet client recording its transfers. */
export function buildFakeWalletClient(
  options: FakeWalletClientOptions = {},
): FakeWalletClientResult {
  const transfers: RecordedTransfer[] = []
  const chainId = options.chainId ?? base.id
  const account = options.noAccount
    ? undefined
    : { address: ACCOUNT_ADDRESS }

  const client: BaseTransferWalletClient = {
    account,
    getChainId: () => Promise.resolve(chainId),
    writeContract: (args) => {
      const isRejected = options.rejectWith !== undefined
      if (isRejected) return Promise.reject(options.rejectWith)
      transfers.push({ to: args.args[0], amount: args.args[1] })
      return Promise.resolve(SENT_HASH)
    },
  }

  return { client, transfers }
}

export interface FakeReceiptClientOptions {
  /** The mined receipt's on-chain status (default `'success'`). */
  readonly status?: 'success' | 'reverted'
}

/** A receipt client that mines the broadcast hash with the given status. */
export function buildFakeReceiptClient(
  options: FakeReceiptClientOptions = {},
): BaseReceiptClient {
  return {
    waitForTransactionReceipt: ({ hash }) =>
      Promise.resolve({ transactionHash: hash, status: options.status ?? 'success' }),
  }
}

/** A receipt client whose poll never resolves in time. */
export function buildTimeoutReceiptClient(hash: `0x${string}`): BaseReceiptClient {
  return {
    waitForTransactionReceipt: () =>
      Promise.reject(new WaitForTransactionReceiptTimeoutError({ hash })),
  }
}

/** A viem-shaped user rejection, for the non-destructive cancel path. */
export function buildUserRejection(): UserRejectedRequestError {
  return new UserRejectedRequestError(new Error('user rejected'))
}

/** A viem-shaped "no ETH on Base for gas" rejection. */
export function buildInsufficientFundsError(): InsufficientFundsError {
  return new InsufficientFundsError()
}

/** A viem-shaped "wallet is on the wrong chain" rejection. */
export function buildChainMismatchError(): ChainMismatchError {
  return new ChainMismatchError({ chain: base, currentChainId: 1 })
}

/** A viem-shaped on-chain revert with no decodable reason (undecoded path). */
export function buildContractRevertedError(): ContractFunctionRevertedError {
  return new ContractFunctionRevertedError({
    abi: ERC20_TRANSFER_ABI,
    data: '0x',
    functionName: 'transfer',
    cause: new Error('reverted'),
  })
}

export const FAKE_SENT_HASH = SENT_HASH
