import type {
  VenueOnboardingInputSpec,
  VenueOnboardingStatus,
  VenueOnboardingStepStatus,
} from '@/modules/shared/domain/venue-onboarding'
import type { WalletAddress } from '@/modules/shared/domain'
import type { AgentWalletState } from '../agent-wallet-provider/agent-wallet-provider.context'
import type { HyperliquidKnownAgent } from '../agent-wallet-provider/agent-wallet-provider.types'
import type { BuilderFeeState } from '../builder-fee-provider/builder-fee-provider.context'
import type { DepositState } from '../deposit-provider/deposit-provider.context'
import {
  mapAgentErrorReasonToStatus,
  mapBuilderErrorReasonToStatus,
  mapDepositErrorReasonToStatus,
} from './error-to-cta-mapping'
import {
  HYPERLIQUID_REPLACE_AGENT_INPUT_ID,
  HYPERLIQUID_REVOKE_BUILDER_INPUT_ID,
} from './hyperliquid-onboarding-provider.types'

/** True when the agent step is in the slots-full state — the victim picker replaces the name input (ADR-0036 D-3). */
export function isAgentSlotsFullStatus(agentStatus: AgentWalletState['status']): boolean {
  const isErrorStatus = typeof agentStatus === 'object'
  if (!isErrorStatus) return false
  return agentStatus.reason === 'agent-slots-full'
}

/** True when the builder step is cap-rejected — the revoke picker renders (ADR-0036 D-4). */
export function isBuilderCapStatus(builderStatus: BuilderFeeState['status']): boolean {
  const isErrorStatus = typeof builderStatus === 'object'
  if (!isErrorStatus) return false
  return builderStatus.reason === 'approval-cap-reached'
}

/**
 * The slots-full victim picker (ADR-0036 D-3). Option value = the agent's
 * exact on-chain name (what the replacement approve must re-use); option label
 * = `<name> — expires <ISO date>` so the user can pick the least-valuable
 * victim.
 */
export function buildAgentReplaceSelect(
  existingAgents: ReadonlyArray<HyperliquidKnownAgent>,
): VenueOnboardingInputSpec {
  return {
    kind: 'select',
    id: HYPERLIQUID_REPLACE_AGENT_INPUT_ID,
    label: 'Table to replace',
    options: existingAgents.map((agent) => ({
      value: agent.name,
      label: `${agent.name} — expires ${formatValidUntilDate(agent.validUntil)}`,
    })),
  }
}

/**
 * The builder revoke picker (ADR-0036 D-4). Builders are bare addresses —
 * the full 0x string is the only identity the user can cross-reference
 * against the frontend/bot that registered it, so no truncation.
 */
export function buildBuilderRevokeSelect(
  approvedBuilders: ReadonlyArray<WalletAddress>,
): VenueOnboardingInputSpec {
  return {
    kind: 'select',
    id: HYPERLIQUID_REVOKE_BUILDER_INPUT_ID,
    label: 'Builder approval to revoke',
    options: approvedBuilders.map((builder) => ({ value: builder, label: builder })),
  }
}

/** `validUntil` (ms epoch) → ISO 8601 date (`2026-08-12`) per the repo's date convention. */
function formatValidUntilDate(validUntilMs: number): string {
  const iso = new Date(validUntilMs).toISOString()
  const dateEnd = iso.indexOf('T')
  return iso.slice(0, dateEnd)
}

export function projectAgentStepStatus(
  agentStatus: AgentWalletState['status'],
): VenueOnboardingStepStatus {
  if (agentStatus === 'approved') return 'complete'
  // 'checking' = bootstrap query in flight (mirrors deposit's 'checking'→'running').
  if (agentStatus === 'checking') return 'running'
  if (agentStatus === 'approving') return 'running'
  if (agentStatus === 'missing') return 'pending'
  return mapAgentErrorReasonToStatus(agentStatus.reason)
}

export function projectBuilderStepStatus(
  builderStatus: BuilderFeeState['status'],
): VenueOnboardingStepStatus {
  if (builderStatus === 'approved') return 'complete'
  // 'checking' = bootstrap query in flight (mirrors deposit's 'checking'→'running').
  if (builderStatus === 'checking') return 'running'
  if (builderStatus === 'approving') return 'running'
  if (builderStatus === 'missing') return 'pending'
  return mapBuilderErrorReasonToStatus(builderStatus.reason)
}

// Deposit step projection (HIGH-1 / D-9 / D-10):
// - 'funded' → 'complete' (deposit done, gate opens)
// - 'checking' → 'running' (bootstrap in progress)
// - 'needs-deposit' → error-status with the in-app open-deposit CTA (so StepRow
//   renders the deposit affordance; a plain 'pending' would render NO CTA —
//   HIGH-1 root cause)
// - {kind:'error',reason} → error-status with the open-deposit CTA (genuine query failure path)
//
// The VENUE-level status stays 'incomplete' (not 'blocked') — D-10 preserves the
// bootstrapping→incomplete auto-open. The per-STEP error-status is distinct from the venue status.
export function projectDepositStepStatus(
  depositStatus: DepositState['status'],
): VenueOnboardingStepStatus {
  if (depositStatus === 'funded') return 'complete'
  if (depositStatus === 'checking') return 'running'
  if (depositStatus === 'needs-deposit') return mapDepositErrorReasonToStatus('deposit-required')
  return mapDepositErrorReasonToStatus(depositStatus.reason)
}

// 3-step composeStatus (deposit + agent + builder).
// NEVER emits a blocked-kind venue status (D-10). The per-step error-status is NOT
// a venue blocked status — they are independent. This preserves the bootstrapping→incomplete
// auto-open that the never-funded user depends on.
export function composeStatus(
  depositStepStatus: VenueOnboardingStepStatus,
  agentStepStatus: VenueOnboardingStepStatus,
  builderStepStatus: VenueOnboardingStepStatus,
  isBootstrapping: boolean,
): VenueOnboardingStatus {
  if (isBootstrapping) return 'bootstrapping'
  // Single composed onboarding condition — the three step conditions are only
  // ever evaluated together here (the caller gates this behind `bootstrapping`
  // until all initial checks have settled), so the venue never reports a
  // piecemeal `incomplete` mid-rehydration.
  const isDepositComplete = stepStatusIsComplete(depositStepStatus)
  const isAgentComplete = stepStatusIsComplete(agentStepStatus)
  const isBuilderComplete = stepStatusIsComplete(builderStepStatus)
  const isOnboarded = isDepositComplete && isAgentComplete && isBuilderComplete
  if (isOnboarded) return 'ready'
  return 'incomplete'
}

export function stepStatusIsComplete(status: VenueOnboardingStepStatus): boolean {
  return status === 'complete'
}
