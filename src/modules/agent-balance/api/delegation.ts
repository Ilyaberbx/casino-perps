import type { ResultAsync } from 'neverthrow'
import type { ApiClient, HttpError } from '@/modules/shared/http'
import type {
  DelegationScope,
  DelegationStatus,
  DelegationStatusView,
  PreparedDelegation,
} from '../agent-balance.types'

/**
 * The server `GET /api/agent-treasury/delegation` body (ADR-0078). `status` is
 * the user-facing lifecycle; `appSignerId` is the app's registered scoped signer
 * id (present on an `active` delegation) so a later session can `removeSigners`
 * on revoke. Every route is **per agent** (ADR-0048 D-3) — `agentId` scopes which
 * AI Agent's delegation is read / prepared / confirmed / revoked.
 */
interface DelegationStatusResponse {
  status: DelegationStatus
  appSignerId?: string | null
  capUsd?: string | null
  expiresAt?: string | null
}

/** The server `POST /api/agent-treasury/delegation` (prepare) body (ADR-0078). */
interface PrepareDelegationResponse {
  appSignerId: string
  policyId: string
  expiresAt: string
}

/** The server `POST /api/agent-treasury/delegation/confirm` + `/revoke` body. */
interface DelegationStatusOnlyResponse {
  status: DelegationStatus
}

/**
 * Read the standing delegation for one agent from the server treasury route.
 * `GET /api/agent-treasury/delegation?agentId=…` → `{ status, appSignerId }`.
 * Thin wrapper over the shared `apiClient` (http.md) — no transport here.
 */
export function getDelegationStatus(
  client: ApiClient,
  agentId: string,
): ResultAsync<DelegationStatusView, HttpError> {
  return client
    .get<DelegationStatusResponse>(
      `/api/agent-treasury/delegation?agentId=${encodeURIComponent(agentId)}`,
    )
    .map((body) => ({
      status: body.status,
      appSignerId: body.appSignerId ?? null,
      capUsd: body.capUsd ?? null,
      expiresAt: body.expiresAt ?? null,
    }))
}

/**
 * PREPARE the scoped delegation for one agent (ADR-0078 grant step 1). The server
 * creates the scoped policy and returns `{ appSignerId, policyId }` but persists
 * NOTHING — the client attaches the signer (`attachAgentSigner`) before the row
 * is confirmed, so there is never an active-but-unattached DB state. The body
 * mirrors the server `grantDelegationSchema` (`agentId` + the scope).
 * `POST /api/agent-treasury/delegation` → `{ appSignerId, policyId, expiresAt }`.
 */
export function grantDelegation(
  client: ApiClient,
  agentId: string,
  scope: DelegationScope,
): ResultAsync<PreparedDelegation, HttpError> {
  return client
    .post<PrepareDelegationResponse>('/api/agent-treasury/delegation', {
      agentId,
      ...scope,
    })
    .map((body) => ({ appSignerId: body.appSignerId, policyId: body.policyId }))
}

/**
 * CONFIRM the prepared delegation after the client has attached the app signer
 * (ADR-0078 grant step 3). The server persists the row `active`. The body carries
 * the prepared `policyId` alongside the same scope; mirrors the server
 * `confirmDelegationSchema`.
 * `POST /api/agent-treasury/delegation/confirm` → `{ status }`.
 */
export function confirmDelegation(
  client: ApiClient,
  agentId: string,
  input: { policyId: string } & DelegationScope,
): ResultAsync<DelegationStatus, HttpError> {
  return client
    .post<DelegationStatusOnlyResponse>('/api/agent-treasury/delegation/confirm', {
      agentId,
      ...input,
    })
    .map((body) => body.status)
}

/**
 * Revoke one agent's standing delegation on the server (ADR-0078). Signer removal
 * is client-side and happens BEFORE this call (`removeAgentSigner`), so the
 * server only marks the row revoked.
 * `POST /api/agent-treasury/delegation/revoke` → `{ status }`.
 */
export function revokeDelegation(
  client: ApiClient,
  agentId: string,
): ResultAsync<DelegationStatus, HttpError> {
  return client
    .post<DelegationStatusOnlyResponse>('/api/agent-treasury/delegation/revoke', {
      agentId,
    })
    .map((body) => body.status)
}
