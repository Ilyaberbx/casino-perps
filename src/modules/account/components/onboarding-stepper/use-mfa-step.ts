import type { ResultAsync } from 'neverthrow'
import type { AuthError } from '../../domain/types'
import { useMfaEnrollment } from '../../hooks/use-mfa-enrollment'
import type { MfaStepView } from './onboarding-stepper.types'

export function useMfaStep(
  setupMfa: () => ResultAsync<void, AuthError>,
  skipMfa: () => void,
): MfaStepView {
  const { isEnrolling, onSetup } = useMfaEnrollment(
    setupMfa,
    'You can add two-factor authentication later from your account.',
  )

  return { kind: 'mfa', isEnrolling, onSetup, onSkip: skipMfa }
}
