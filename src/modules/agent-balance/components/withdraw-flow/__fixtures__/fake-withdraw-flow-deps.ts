import { errAsync, okAsync } from 'neverthrow'
import type { AgentWalletAddress } from '../../../agent-balance.types'
import {
  BaseUsdcTransferError,
  type AgentWithdrawAuthorizer,
} from '../../../agent-balance.types'
import type { WithdrawFlowDeps } from '../use-withdraw-flow'

export const VALID_DESTINATION =
  '0x5555555555555555555555555555555555555555' as AgentWalletAddress

const SENT_HASH =
  '0xfed0000000000000000000000000000000000000000000000000000000000fed' as const

export interface WithdrawSpy {
  authorized: { destination: AgentWalletAddress; amount: number }[]
  /** Set true if the (forbidden) standing delegation is ever consulted. */
  usedDelegatedSigner: boolean
}

/**
 * An authorizer whose `authorizeAndSend` is the EXPLICIT per-action path. The
 * spy records each call so the test can prove the explicit path ran and the
 * delegated signer never did (ADR-0046 D-7).
 */
export function buildOkWithdrawAuthorizer(spy: WithdrawSpy): AgentWithdrawAuthorizer {
  return {
    authorizeAndSend: (destination, amount) => {
      spy.authorized.push({ destination, amount })
      return okAsync({ transactionHash: SENT_HASH })
    },
  }
}

export function buildRejectedWithdrawAuthorizer(): AgentWithdrawAuthorizer {
  return {
    authorizeAndSend: () =>
      errAsync(new BaseUsdcTransferError('wallet-rejected', 'declined')),
  }
}

export function buildFailingWithdrawAuthorizer(): AgentWithdrawAuthorizer {
  return {
    authorizeAndSend: () =>
      errAsync(new BaseUsdcTransferError('transfer-failed', 'rpc down')),
  }
}

export function buildInsufficientGasWithdrawAuthorizer(): AgentWithdrawAuthorizer {
  return {
    authorizeAndSend: () =>
      errAsync(new BaseUsdcTransferError('insufficient-gas', 'no eth for gas')),
  }
}

export function buildInsufficientBalanceWithdrawAuthorizer(): AgentWithdrawAuthorizer {
  return {
    authorizeAndSend: () =>
      errAsync(new BaseUsdcTransferError('insufficient-balance', 'reverted on-chain')),
  }
}

export function buildReceiptTimeoutWithdrawAuthorizer(): AgentWithdrawAuthorizer {
  return {
    authorizeAndSend: () =>
      errAsync(new BaseUsdcTransferError('receipt-timeout', 'receipt poll timed out')),
  }
}

export function buildWrongNetworkWithdrawAuthorizer(): AgentWithdrawAuthorizer {
  return {
    authorizeAndSend: () =>
      errAsync(new BaseUsdcTransferError('wrong-network', 'chain mismatch')),
  }
}

export interface FakeWithdrawDepsOptions {
  readonly authorizer?: AgentWithdrawAuthorizer
  readonly availableUsdc?: number
  readonly switchToBase?: () => Promise<'switched' | 'rejected' | 'failed'>
}

export function buildWithdrawDeps(
  options: FakeWithdrawDepsOptions = {},
  spy: WithdrawSpy = { authorized: [], usedDelegatedSigner: false },
): WithdrawFlowDeps {
  return {
    availableUsdc: options.availableUsdc ?? 100,
    getWithdrawAuthorizer: () => options.authorizer ?? buildOkWithdrawAuthorizer(spy),
    walletSuggestions: [],
    recentSuggestions: [],
    onRecordRecipient: () => {},
    switchToBase: options.switchToBase ?? (() => Promise.resolve('switched')),
  }
}

export const WITHDRAW_SENT_HASH = SENT_HASH
