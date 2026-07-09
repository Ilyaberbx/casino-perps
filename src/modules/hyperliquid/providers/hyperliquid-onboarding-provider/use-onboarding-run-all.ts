import { useCallback, type RefObject } from 'react'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'
import {
  VenueOnboardingError,
  type VenueOnboardingStepStatus,
} from '@/modules/shared/domain/venue-onboarding'
import type { WalletAddress } from '@/modules/shared/domain'
import {
  HYPERLIQUID_STEP_AGENT_ID,
  HYPERLIQUID_STEP_DEPOSIT_ID,
} from './hyperliquid-onboarding-provider.types'
import type { OnboardingLegs } from './use-onboarding-legs'
import { stepStatusIsComplete } from './hyperliquid-onboarding.utils'

export interface OnboardingRunAllOptions {
  readonly isRunningRef: RefObject<boolean>
  readonly depositStepStatus: VenueOnboardingStepStatus
  readonly agentStepStatus: VenueOnboardingStepStatus
  readonly builderStepStatus: VenueOnboardingStepStatus
  readonly legs: OnboardingLegs
  resolveAgentName(values: Readonly<Record<string, string>>): string
  /** Non-null when the builder revoke picker chose a victim — routes the builder leg through the revoke→approve chain (ADR-0036 D-4). */
  resolveBuilderVictim(values: Readonly<Record<string, string>>): WalletAddress | null
}

/**
 * `runAll` runs the agent leg then the builder leg sequentially, gated on the
 * deposit being complete (T-07-11). Read-only guards (busy, deposit-required)
 * run BEFORE the running flag is set, so neither has to undo it (WR-ON-02);
 * the flag is set + reset in a single place by `legs.withRunningGuard` (WR-ON-01).
 *
 * CR-01 (double-sign of the non-idempotent on-chain approve) is closed by
 * `approve()` having a SINGLE SERIALIZED CALLER — `runAll`/`retryStep`, mutually
 * excluded by `isRunningRef`. The completeness pre-checks below read a
 * render-captured `*StepStatus` (closed over by `useCallback`); they only
 * short-circuit re-invocation when the status was already complete at this
 * render — they do NOT protect against a concurrent external caller flipping
 * the status mid-run. If a second consumer of `approve()` is ever added (e.g.
 * the deferred order-placement contract), gate each leg on a live-status ref
 * instead. See `hyperliquid/MODULE.md` (BuilderFeeProvider).
 */
export function useOnboardingRunAll(
  options: OnboardingRunAllOptions,
): (values: Readonly<Record<string, string>>) => ResultAsync<void, VenueOnboardingError> {
  const {
    isRunningRef,
    depositStepStatus,
    agentStepStatus,
    builderStepStatus,
    legs,
    resolveAgentName,
    resolveBuilderVictim,
  } = options

  return useCallback(
    (values: Readonly<Record<string, string>>): ResultAsync<void, VenueOnboardingError> => {
      const isBusy = isRunningRef.current
      if (isBusy) {
        return errAsync(
          new VenueOnboardingError(
            HYPERLIQUID_STEP_AGENT_ID,
            'busy',
            'onboarding is already running',
          ),
        )
      }

      // Hard gate: deposit must be complete before agent or builder signing (T-07-11).
      const isDepositComplete = stepStatusIsComplete(depositStepStatus)
      if (!isDepositComplete) {
        return errAsync(
          new VenueOnboardingError(
            HYPERLIQUID_STEP_DEPOSIT_ID,
            'deposit-required',
            'deposit must be funded before setting up agent and builder',
          ),
        )
      }

      const agentName = resolveAgentName(values)
      const isAgentComplete = stepStatusIsComplete(agentStepStatus)
      const agentLeg = isAgentComplete ? okAsync(undefined) : legs.approveAgentLeg(agentName)

      const runBuilderLeg = (): ResultAsync<void, VenueOnboardingError> => {
        const isBuilderComplete = stepStatusIsComplete(builderStepStatus)
        if (isBuilderComplete) return okAsync(undefined)
        const builderVictim = resolveBuilderVictim(values)
        if (builderVictim !== null) return legs.replaceBuilderLeg(builderVictim)
        return legs.approveBuilderLeg()
      }

      return legs.withRunningGuard(agentLeg.andThen(() => runBuilderLeg()))
    },
    [
      isRunningRef,
      depositStepStatus,
      agentStepStatus,
      builderStepStatus,
      legs,
      resolveAgentName,
      resolveBuilderVictim,
    ],
  )
}
