import { useCallback, type RefObject } from 'react'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'
import { VenueOnboardingError } from '@/modules/shared/domain/venue-onboarding'
import type { WalletAddress } from '@/modules/shared/domain'
import type { DepositState } from '../deposit-provider/deposit-provider.context'
import {
  HYPERLIQUID_STEP_AGENT_ID,
  HYPERLIQUID_STEP_BUILDER_ID,
  HYPERLIQUID_STEP_DEPOSIT_ID,
} from './hyperliquid-onboarding-provider.types'
import type { OnboardingLegs } from './use-onboarding-legs'

export interface OnboardingRetryStepOptions {
  readonly isRunningRef: RefObject<boolean>
  readonly depositRecheck: DepositState['recheck']
  readonly legs: OnboardingLegs
  resolveAgentName(values: Readonly<Record<string, string>>): string
  /** Non-null when the builder revoke picker chose a victim — routes the builder leg through the revoke→approve chain (ADR-0036 D-4). */
  resolveBuilderVictim(values: Readonly<Record<string, string>>): WalletAddress | null
}

/**
 * `retryStep` re-fires a single step. The agent/builder legs await their real
 * approve result through `legs.withRunningGuard`; the deposit leg is
 * deliberately different — `recheck()` is a synchronous, fire-and-forget status
 * refresh (no signing, D-7 / Pitfall 4), so it returns `okAsync(undefined)`
 * immediately. That asymmetry is intentional and explicit here (WR-ON-04): the
 * caller is told the *refresh was kicked*, not that the account is now funded —
 * the deposit step's own status reflects the re-check result when it lands.
 */
export function useOnboardingRetryStep(
  options: OnboardingRetryStepOptions,
): (
  stepId: string,
  values: Readonly<Record<string, string>>,
) => ResultAsync<void, VenueOnboardingError> {
  const { isRunningRef, depositRecheck, legs, resolveAgentName, resolveBuilderVictim } = options

  return useCallback(
    (
      stepId: string,
      values: Readonly<Record<string, string>>,
    ): ResultAsync<void, VenueOnboardingError> => {
      const isBusy = isRunningRef.current
      if (isBusy) {
        return errAsync(new VenueOnboardingError(stepId, 'busy', 'onboarding is already running'))
      }

      const isDepositStep = stepId === HYPERLIQUID_STEP_DEPOSIT_ID
      const isAgentStep = stepId === HYPERLIQUID_STEP_AGENT_ID
      const isBuilderStep = stepId === HYPERLIQUID_STEP_BUILDER_ID
      const isKnownStep = isDepositStep || isAgentStep || isBuilderStep
      if (!isKnownStep) {
        return errAsync(
          new VenueOnboardingError(stepId, 'unknown-step', `unknown step id: ${stepId}`),
        )
      }

      // Deposit retry: kick a fire-and-forget recheck() — no signing, no busy
      // flag (it returns synchronously). The deposit step's status reflects the
      // result when the re-check resolves (WR-ON-04 / D-7 / Pitfall 4).
      if (isDepositStep) {
        depositRecheck()
        return okAsync(undefined)
      }

      // Legs fire their signature request the moment they are constructed
      // (ResultAsync is eager) — build ONLY the leg this retry targets.
      if (isAgentStep) {
        return legs.withRunningGuard(legs.approveAgentLeg(resolveAgentName(values)))
      }
      const builderVictim = resolveBuilderVictim(values)
      const builderLeg =
        builderVictim === null ? legs.approveBuilderLeg() : legs.replaceBuilderLeg(builderVictim)
      return legs.withRunningGuard(builderLeg)
    },
    [isRunningRef, depositRecheck, legs, resolveAgentName, resolveBuilderVictim],
  )
}
