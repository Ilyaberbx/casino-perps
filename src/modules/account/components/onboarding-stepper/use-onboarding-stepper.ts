import { useCallback, useEffect } from 'react'
import { okAsync, type ResultAsync } from 'neverthrow'
import { useAuth } from '../../providers/auth-provider'
import { useOnboardingFlow } from '../../hooks/use-onboarding-flow'
import type { HttpError } from '@/modules/shared/http'
import type { AuthError } from '../../domain/types'
import { useEmailOtpSteps } from './use-email-otp-steps'
import { useHandleStep } from './use-handle-step'
import { useMfaStep } from './use-mfa-step'
import { usePersonalizeStep } from './use-personalize-step'
import { TOTAL_STEPS } from './onboarding-stepper.constants'
import type { OnboardingStepperView, StepView } from './onboarding-stepper.types'

const NOOP_SUBMIT_HANDLE = (): ResultAsync<void, HttpError> => okAsync(undefined)
const NOOP_SETUP_MFA = (): ResultAsync<void, AuthError> => okAsync(undefined)
const NOOP = (): void => undefined

/**
 * Whether the stepper should be on screen. It is visible while the connect modal
 * is open (pre-auth Email → OTP) AND while the post-auth FSM still needs the user
 * to act (Handle / 2FA). The latter is essential: once authenticated,
 * `isConnectModalOpen` is always `false` (it is gated on `!authenticated`), so an
 * already-authenticated user whose account still needs a handle would otherwise
 * have no surface to complete onboarding — and the header account trigger (shown
 * only at `ready`) would never appear.
 */
export function useOnboardingStepperVisibility(): boolean {
  const { isConnectModalOpen } = useAuth()
  const flow = useOnboardingFlow()
  const hasPendingOnboardingStep =
    flow.kind === 'needs-handle' ||
    flow.kind === 'needs-mfa' ||
    flow.kind === 'needs-personalize'
  return isConnectModalOpen || hasPendingOnboardingStep
}

/**
 * Drives the onboarding stepper (PRD-0006 UI-1). Steps 1-2 (Email → OTP) are the
 * pre-auth Privy email-OTP flow; once authenticated, the post-auth onboarding
 * FSM (`useOnboardingFlow`) drives steps 3-5 (Handle → 2FA → Personalize) for new
 * accounts only. A returning user authenticates, the FSM goes straight to
 * `ready`, and the modal closes. The hook calls all step sub-hooks
 * unconditionally (rules of hooks) and picks which `StepView` to surface.
 */
export function useOnboardingStepper(): OnboardingStepperView {
  const { closeConnectModal } = useAuth()
  const flow = useOnboardingFlow()
  const { phase, emailView, otpView } = useEmailOtpSteps()

  const submitHandle = flow.kind === 'needs-handle' ? flow.submitHandle : NOOP_SUBMIT_HANDLE
  const setupMfa = flow.kind === 'needs-mfa' ? flow.setupMfa : NOOP_SETUP_MFA
  const skipMfa = flow.kind === 'needs-mfa' ? flow.skipMfa : NOOP
  const finishPersonalize = flow.kind === 'needs-personalize' ? flow.finishPersonalize : NOOP

  const handleView = useHandleStep(submitHandle)
  const mfaView = useMfaStep(setupMfa, skipMfa)
  const personalizeView = usePersonalizeStep(finishPersonalize)

  const isReady = flow.kind === 'ready'
  useEffect(() => {
    if (isReady) closeConnectModal()
  }, [isReady, closeConnectModal])

  const { step, stepNumber } = pickStep(flow.kind, phase, {
    emailView,
    otpView,
    handleView,
    mfaView,
    personalizeView,
  })

  const onClose = useCallback(() => closeConnectModal(), [closeConnectModal])

  return { step, stepNumber, totalSteps: TOTAL_STEPS, onClose }
}

function pickStep(
  flowKind: ReturnType<typeof useOnboardingFlow>['kind'],
  phase: 'email' | 'otp',
  views: {
    emailView: StepView
    otpView: StepView
    handleView: StepView
    mfaView: StepView
    personalizeView: StepView
  },
): { step: StepView; stepNumber: number } {
  if (flowKind === 'needs-handle') return { step: views.handleView, stepNumber: 3 }
  if (flowKind === 'needs-mfa') return { step: views.mfaView, stepNumber: 4 }
  if (flowKind === 'needs-personalize') return { step: views.personalizeView, stepNumber: 5 }
  if (phase === 'otp') return { step: views.otpView, stepNumber: 2 }
  return { step: views.emailView, stepNumber: 1 }
}
