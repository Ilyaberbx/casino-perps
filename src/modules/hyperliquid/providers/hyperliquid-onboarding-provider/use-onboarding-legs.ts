import { useCallback, type RefObject } from 'react'
import { ResultAsync } from 'neverthrow'
import { VenueOnboardingError } from '@/modules/shared/domain/venue-onboarding'
import type { WalletAddress } from '@/modules/shared/domain'
import type { AgentWalletState } from '../agent-wallet-provider/agent-wallet-provider.context'
import type { BuilderFeeState } from '../builder-fee-provider/builder-fee-provider.context'
import {
  HYPERLIQUID_STEP_AGENT_ID,
  HYPERLIQUID_STEP_BUILDER_ID,
} from './hyperliquid-onboarding-provider.types'

export interface OnboardingLegs {
  /** Approve the agent, wrapping any failure into a step-tagged VenueOnboardingError. */
  approveAgentLeg(agentName: string): ResultAsync<void, VenueOnboardingError>
  /** Approve the builder fee, wrapping any failure into a step-tagged VenueOnboardingError. */
  approveBuilderLeg(): ResultAsync<void, VenueOnboardingError>
  /**
   * Revoke the victim builder's approval (0% re-approve) then approve ours —
   * the builder-cap recovery chain (ADR-0036 D-4). Same step tag as
   * `approveBuilderLeg`.
   */
  replaceBuilderLeg(victimBuilder: WalletAddress): ResultAsync<void, VenueOnboardingError>
  /**
   * Run a leg under the busy flag: set the ref on entry, reset it in a single
   * success/error tail (WR-ON-01 — no hand-written resets scattered per path).
   * Read-only guards (busy / deposit-required / unknown-step) must run BEFORE
   * this so they never have to undo the ref (WR-ON-02).
   */
  withRunningGuard(
    leg: ResultAsync<void, VenueOnboardingError>,
  ): ResultAsync<void, VenueOnboardingError>
}

/**
 * Shared agent/builder approval legs + the running-flag finalizer, consumed by
 * both `useOnboardingRunAll` and `useOnboardingRetryStep` (WR-ON-03). The legs
 * wrap the providers' `approve` into the venue-onboarding error shape once, so
 * neither caller re-derives the mapping.
 */
export function useOnboardingLegs(
  isRunningRef: RefObject<boolean>,
  agentApprove: AgentWalletState['approve'],
  builderApprove: BuilderFeeState['approve'],
  builderReplace: BuilderFeeState['replaceBuilder'],
): OnboardingLegs {
  const approveAgentLeg = useCallback(
    (agentName: string): ResultAsync<void, VenueOnboardingError> =>
      agentApprove(agentName).mapErr(
        (cause) =>
          new VenueOnboardingError(HYPERLIQUID_STEP_AGENT_ID, cause.kind, cause.message, cause),
      ),
    [agentApprove],
  )

  const approveBuilderLeg = useCallback(
    (): ResultAsync<void, VenueOnboardingError> =>
      builderApprove().mapErr(
        (cause) =>
          new VenueOnboardingError(HYPERLIQUID_STEP_BUILDER_ID, cause.kind, cause.message, cause),
      ),
    [builderApprove],
  )

  const replaceBuilderLeg = useCallback(
    (victimBuilder: WalletAddress): ResultAsync<void, VenueOnboardingError> =>
      builderReplace(victimBuilder).mapErr(
        (cause) =>
          new VenueOnboardingError(HYPERLIQUID_STEP_BUILDER_ID, cause.kind, cause.message, cause),
      ),
    [builderReplace],
  )

  const withRunningGuard = useCallback(
    (
      leg: ResultAsync<void, VenueOnboardingError>,
    ): ResultAsync<void, VenueOnboardingError> => {
      isRunningRef.current = true
      return leg
        .map(() => {
          isRunningRef.current = false
        })
        .mapErr((e) => {
          isRunningRef.current = false
          return e
        })
    },
    [isRunningRef],
  )

  return { approveAgentLeg, approveBuilderLeg, replaceBuilderLeg, withRunningGuard }
}
