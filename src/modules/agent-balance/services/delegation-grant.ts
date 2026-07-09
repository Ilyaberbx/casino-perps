import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import type { ApiClient } from '@/modules/shared/http'
import {
  confirmDelegation,
  getDelegationStatus,
  grantDelegation,
  revokeDelegation,
} from '../api/delegation'
import {
  DelegationGrantError,
  type AgentWalletAddress,
  type AttachAgentSigner,
  type DelegationGrantPort,
  type DelegationScope,
  type DelegationStatus,
  type DelegationStatusView,
  type PreparedDelegation,
  type RemoveAgentSigner,
} from '../agent-balance.types'

export interface CreateDelegationGrantOptions {
  /** The shared `apiClient` for the server prepare / confirm / revoke calls. */
  readonly client: ApiClient
  /** The AI Agent this grant is scoped to (ADR-0048 D-3 — per-agent delegation). */
  readonly agentId: string
  /** The Agent Wallet address the app signer is attached to / removed from (ADR-0078). */
  readonly address: AgentWalletAddress
  /** Attaches the app as a scoped signer (Privy seam, injected — false ⇒ decline). */
  readonly attachAgentSigner: AttachAgentSigner
  /** Removes the app signer on revoke (Privy seam, injected). */
  readonly removeAgentSigner: RemoveAgentSigner
}

/**
 * The delegation-grant seam (ADR-0078 3-step handshake). `grant` PREPAREs the
 * scoped policy on the server (`{ appSignerId, policyId }`, nothing persisted),
 * ATTACHes the app signer client-side (`attachAgentSigner` — `false` ⇒
 * `signer-rejected`, never an active-but-unattached row), then CONFIRMs to
 * persist the row `active`. `revoke` reads the standing `appSignerId`, removes the
 * app signer client-side FIRST, then marks the server row revoked. Every server
 * step's `HttpError` is wrapped into `DelegationGrantError('server', …)`; the
 * Privy attach/remove halves are injected so this code never imports the Privy
 * SDK directly (import-boundary asserted by test).
 */
export function createDelegationGrant(
  options: CreateDelegationGrantOptions,
): DelegationGrantPort {
  const { client, agentId, address, attachAgentSigner, removeAgentSigner } = options

  const grant = (
    scope: DelegationScope,
  ): ResultAsync<DelegationStatus, DelegationGrantError> =>
    grantDelegation(client, agentId, scope)
      .mapErr(
        (error) =>
          new DelegationGrantError('server', 'server prepare failed', error),
      )
      .andThen((prepared) => attachSigner(attachAgentSigner, address, prepared))
      .andThen((prepared) =>
        confirmDelegation(client, agentId, {
          policyId: prepared.policyId,
          ...scope,
        }).mapErr(
          (error) =>
            new DelegationGrantError('server', 'server confirm failed', error),
        ),
      )

  const revoke = (): ResultAsync<DelegationStatus, DelegationGrantError> =>
    getDelegationStatus(client, agentId)
      .mapErr(
        (error) =>
          new DelegationGrantError('server', 'server status read failed', error),
      )
      .andThen((view) => removeSigner(removeAgentSigner, address, view.appSignerId))
      .andThen(() =>
        revokeDelegation(client, agentId).mapErr(
          (error) =>
            new DelegationGrantError('server', 'server revoke failed', error),
        ),
      )

  return { grant, revoke }
}

/**
 * Bind the env-backed production status reader: a zero-arg fetcher over the
 * shared `apiClient` resolving the full `DelegationStatusView` (status + granted
 * cap / expiry), falling back to an empty not-granted view on any read failure so
 * the consent surface never crashes on a transient error. Tests substitute a fake
 * reader instead, so this never runs under test.
 */
export function resolveDefaultGetDelegationStatus(
  client: ApiClient,
  agentId: string,
): () => Promise<DelegationStatusView> {
  return () =>
    getDelegationStatus(client, agentId).unwrapOr({
      status: 'not-granted',
      appSignerId: null,
      capUsd: null,
      expiresAt: null,
    })
}

/**
 * Run the Privy attach-signer step. `false` ⇒ the owner declined the confirmation
 * (`signer-rejected`, non-destructive — confirm never runs). A throw (SDK /
 * network failure) ⇒ `signer-failed`. On success the prepared delegation is
 * passed through so `confirm` can carry the `policyId`.
 */
function attachSigner(
  attachAgentSigner: AttachAgentSigner,
  address: AgentWalletAddress,
  prepared: PreparedDelegation,
): ResultAsync<PreparedDelegation, DelegationGrantError> {
  return ResultAsync.fromPromise(
    attachAgentSigner({
      address,
      appSignerId: prepared.appSignerId,
      policyId: prepared.policyId,
    }),
    (cause) => new DelegationGrantError('signer-failed', 'attach signer failed', cause),
  ).andThen((attached) => {
    if (!attached) {
      return errAsync(
        new DelegationGrantError('signer-rejected', 'owner declined signer'),
      )
    }
    return okAsync(prepared)
  })
}

/**
 * Run the Privy remove-signer step (revoke). Mirrors `attachSigner`: `false` ⇒
 * the owner declined the removal confirmation (`signer-rejected`, non-destructive
 * — the server revoke never runs, the row stays active). `true` ⇒ removal
 * succeeded OR was a best-effort no-op (the seam swallows a benign Privy throw
 * such as the signer already being gone), so the authoritative server row-revoke
 * proceeds. A throw here is a residual safety net ⇒ `signer-failed`. The
 * `appSignerId` may be `null` when no standing signer is recorded; Privy's
 * `removeSigners` removes all signers on the wallet by address, so the id is
 * informational only.
 */
function removeSigner(
  removeAgentSigner: RemoveAgentSigner,
  address: AgentWalletAddress,
  appSignerId: string | null,
): ResultAsync<void, DelegationGrantError> {
  return ResultAsync.fromPromise(
    removeAgentSigner({ address, appSignerId: appSignerId ?? '' }),
    (cause) => new DelegationGrantError('signer-failed', 'remove signer failed', cause),
  ).andThen((removed) => {
    if (!removed) {
      return errAsync(
        new DelegationGrantError('signer-rejected', 'owner declined revoke'),
      )
    }
    return okAsync(undefined)
  })
}
