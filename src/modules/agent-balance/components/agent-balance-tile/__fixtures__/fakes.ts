import { okAsync, errAsync, type ResultAsync } from 'neverthrow'
import { NetworkError, type HttpError } from '@/modules/shared/http'
import type {
  AgentWalletAddress,
  BaseUsdcBalanceReader,
} from '../../../agent-balance.types'
import type { GetAgentWallet, AgentWalletInfo } from '../../../api/get-agent-wallet'
import type { RegisterAgentWalletInput } from '../../../api/register-agent-wallet'

/** A reader that always resolves the given dollar balance. */
export function buildOkReader(balance: number): BaseUsdcBalanceReader {
  return { readUsdcBalance: () => okAsync(balance) }
}

/** A reader that always fails with the single read-failed tag. */
export function buildErrReader(): BaseUsdcBalanceReader {
  return {
    readUsdcBalance: () =>
      errAsync({ kind: 'balance-read-failed', cause: new Error('boom') }),
  }
}

/** An api fetcher resolving a fixed, registered agent wallet (ADR-0078). */
export function buildOkAgentWallet(address: AgentWalletAddress): GetAgentWallet {
  return () => okAsync({ address })
}

/** An api fetcher resolving `null` — the server returned 404 (not registered). */
export function buildNotRegisteredAgentWallet(): GetAgentWallet {
  return () => okAsync(null)
}

/** An api fetcher that fails (non-404 transport error). */
export function buildErrAgentWallet(): GetAgentWallet {
  return () => errAsync(new NetworkError('offline', new Error('offline')))
}

/** A create-agent-wallet seam resolving a fixed address + walletId. */
export function buildOkCreateAgentWallet(
  address: AgentWalletAddress,
  walletId = 'w',
): () => Promise<{ address: string; walletId: string }> {
  return () => Promise.resolve({ address, walletId })
}

/** A create-agent-wallet seam that throws (e.g. the user declined / Privy down). */
export function buildErrCreateAgentWallet(): () => Promise<{
  address: string
  walletId: string
}> {
  return () => Promise.reject(new Error('create failed'))
}

/** A register-agent-wallet seam resolving a fixed registered wallet. */
export function buildOkRegisterAgentWallet(
  address: AgentWalletAddress,
): (input: RegisterAgentWalletInput) => ResultAsync<AgentWalletInfo, HttpError> {
  return () => okAsync({ address })
}
