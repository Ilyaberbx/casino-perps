import type { AgentWalletAddress } from '../../agent-balance.types'
import type { BaseTransferWalletClient } from '../base-usdc-transfer.types'
import { buildFakeWalletClient } from './fake-transfer-clients'

/**
 * Records which signing path the withdraw authorizer took. The whole point of
 * issue #211 is that withdraw uses the EXPLICIT per-action authorization, never
 * the standing delegated signer — so the fixture exposes both and the test
 * asserts the delegated path is never touched.
 */
export interface WithdrawSpy {
  /** Bumped once each time the explicit per-action prompt is requested. */
  explicitAuthorizationCalls: number
  /** Bumped if the (forbidden) delegated signer is ever invoked. */
  delegatedSignerCalls: number
}

export interface FakeWithdrawDeps {
  readonly spy: WithdrawSpy
  /** Resolves a FRESH per-action signing client (the explicit-auth surface). */
  readonly requestExplicitAuthorization: () => Promise<BaseTransferWalletClient | null>
  /** The standing delegated signer — must never be called by withdraw. */
  readonly delegatedSigner: () => Promise<BaseTransferWalletClient | null>
  /** Records of every transfer the explicit client broadcast. */
  readonly transfers: { to: AgentWalletAddress; amount: bigint }[]
}

export interface FakeWithdrawOptions {
  /** When true, the explicit prompt resolves null (no authorization granted). */
  readonly noAuthorization?: boolean
  /** When set, the explicit client's broadcast rejects with this. */
  readonly rejectWith?: unknown
}

export function buildFakeWithdrawDeps(
  options: FakeWithdrawOptions = {},
): FakeWithdrawDeps {
  const spy: WithdrawSpy = { explicitAuthorizationCalls: 0, delegatedSignerCalls: 0 }
  const { client, transfers } = buildFakeWalletClient({
    rejectWith: options.rejectWith,
  })

  const requestExplicitAuthorization = (): Promise<BaseTransferWalletClient | null> => {
    spy.explicitAuthorizationCalls += 1
    if (options.noAuthorization) return Promise.resolve(null)
    return Promise.resolve(client)
  }

  const delegatedSigner = (): Promise<BaseTransferWalletClient | null> => {
    spy.delegatedSignerCalls += 1
    return Promise.resolve(client)
  }

  return { spy, requestExplicitAuthorization, delegatedSigner, transfers }
}
