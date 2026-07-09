import type { VenueOnboarding } from '@/modules/shared/domain/venue-onboarding'

/**
 * Hyperliquid implementation of the {@link VenueOnboarding} port. Composes the
 * existing `AgentWalletProvider` + `BuilderFeeProvider` states into a single
 * venue-agnostic surface consumed by the generic onboarding sheet/banner/gate.
 *
 * See `.design/hyperliquid-onboarding/TASKS.md` PR 3 (T3.6) and ADR-0026.
 */
export type HyperliquidVenueOnboarding = VenueOnboarding

export const HYPERLIQUID_STEP_DEPOSIT_ID = 'deposit'
export const HYPERLIQUID_STEP_AGENT_ID = 'agent'
export const HYPERLIQUID_STEP_BUILDER_ID = 'builder'

export const HYPERLIQUID_AGENT_NAME_INPUT_ID = 'agentName'

/**
 * Select-input id for the slots-full agent victim picker (ADR-0036 D-3). The
 * selected value is the existing agent's exact name — re-approving under it
 * replaces that agent atomically.
 */
export const HYPERLIQUID_REPLACE_AGENT_INPUT_ID = 'replaceAgentName'

/**
 * Select-input id for the builder-cap revoke picker (ADR-0036 D-4). The
 * selected value is the victim builder's address; the retry leg chains
 * revoke(0%) → approve(ours).
 */
export const HYPERLIQUID_REVOKE_BUILDER_INPUT_ID = 'revokeBuilderAddress'
