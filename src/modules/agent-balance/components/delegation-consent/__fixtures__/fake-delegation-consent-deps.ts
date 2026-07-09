import { errAsync, okAsync } from 'neverthrow'
import {
  DelegationGrantError,
  type AgentWalletAddress,
  type DelegationConsentErrorReason,
  type DelegationGrantPort,
  type DelegationScope,
  type DelegationStatus,
  type DelegationStatusView,
} from '../../../agent-balance.types'
import type { DelegationConsentDeps } from '../use-delegation-consent'

export const MINARA_RECIPIENT =
  '0x5555555555555555555555555555555555555555' as AgentWalletAddress

/** A fixed clock so the built `expiresAt` (now + 30d default) is deterministic. */
export const FIXED_NOW = (): Date => new Date('2026-06-12T00:00:00.000Z')

/** The scope the default fixture grants: cap 50, ttl 30 → expiry 30d after FIXED_NOW. */
export const FAKE_SCOPE: DelegationScope = {
  action: 'usdc-transfer-with-authorization',
  recipient: MINARA_RECIPIENT,
  capUsd: '50.00',
  expiresAt: '2026-07-12T00:00:00.000Z',
}

export interface DelegationSpy {
  granted: DelegationScope[]
  revoked: number
}

export interface FakeGrantPortOptions {
  /** The status the grant resolves to (`active` by default). */
  readonly grantStatus?: DelegationStatus
  /** The status the revoke resolves to (`revoked` by default). */
  readonly revokeStatus?: DelegationStatus
  /** When set, `grant` fails with this reason instead of succeeding. */
  readonly grantFailsWith?: DelegationConsentErrorReason & ('signer-rejected' | 'signer-failed' | 'server')
  /** When set, `revoke` fails with this reason instead of succeeding. */
  readonly revokeFailsWith?: 'signer-rejected' | 'signer-failed' | 'server'
}

/** A delegation-grant port that records each grant / revoke, succeeding by default. */
export function buildFakeGrantPort(
  options: FakeGrantPortOptions = {},
  spy: DelegationSpy = { granted: [], revoked: 0 },
): DelegationGrantPort {
  return {
    grant: (scope) => {
      spy.granted.push(scope)
      if (options.grantFailsWith) {
        return errAsync(new DelegationGrantError(options.grantFailsWith, 'fake grant failure'))
      }
      return okAsync(options.grantStatus ?? 'active')
    },
    revoke: () => {
      spy.revoked += 1
      if (options.revokeFailsWith) {
        return errAsync(new DelegationGrantError(options.revokeFailsWith, 'fake revoke failure'))
      }
      return okAsync(options.revokeStatus ?? 'revoked')
    },
  }
}

export interface FakeConsentDepsOptions {
  readonly initialStatus?: DelegationStatus
  /** A full view override (status + granted cap / expiry) — wins over `initialStatus`. */
  readonly initialView?: DelegationStatusView
  readonly port?: DelegationGrantPort
  readonly recipient?: AgentWalletAddress
  readonly now?: () => Date
}

export function buildConsentDeps(
  options: FakeConsentDepsOptions = {},
  spy: DelegationSpy = { granted: [], revoked: 0 },
): DelegationConsentDeps {
  const view: DelegationStatusView = options.initialView ?? {
    status: options.initialStatus ?? 'not-granted',
    appSignerId: null,
    capUsd: null,
    expiresAt: null,
  }
  return {
    recipient: options.recipient ?? MINARA_RECIPIENT,
    getStatus: () => Promise.resolve(view),
    getGrantPort: () => options.port ?? buildFakeGrantPort({}, spy),
    now: options.now ?? FIXED_NOW,
  }
}
