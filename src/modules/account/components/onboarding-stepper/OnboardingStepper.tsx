import { Modal } from '@/modules/shared/components/modal'
import { useOnboardingStepper, useOnboardingStepperVisibility } from './use-onboarding-stepper'
import { StepIndicator } from './StepIndicator'
import { EmailStep } from './EmailStep'
import { OtpStep } from './OtpStep'
import { HandleStep } from './HandleStep'
import { MfaStep } from './MfaStep'
import { PersonalizeStep } from './PersonalizeStep'
import styles from './onboarding-stepper.module.css'
import type { StepView } from './onboarding-stepper.types'

/**
 * The email-only onboarding stepper (PRD-0006 UI-1). Mounted once by
 * `AuthProvider`; visible while the connect modal is open (Email → OTP) and
 * while the post-auth FSM still needs the user to set a handle, 2FA, or
 * appearance prefs. Body swaps per step (`Email → OTP → Handle → 2FA →
 * Personalize`) inside the shared focus-trapped `Modal`.
 */
export function OnboardingStepper() {
  const isVisible = useOnboardingStepperVisibility()
  if (!isVisible) return null
  return <OnboardingStepperContent />
}

function OnboardingStepperContent() {
  const view = useOnboardingStepper()
  return (
    <Modal isOpen onClose={view.onClose} ariaLabel="Log In" title="Log In">
      <div className={styles.body} data-testid="onboarding-stepper">
        <StepIndicator current={view.stepNumber} total={view.totalSteps} />
        <StepBody step={view.step} />
      </div>
    </Modal>
  )
}

function StepBody({ step }: { step: StepView }) {
  if (step.kind === 'email') return <EmailStep view={step} />
  if (step.kind === 'otp') return <OtpStep view={step} />
  if (step.kind === 'handle') return <HandleStep view={step} />
  if (step.kind === 'mfa') return <MfaStep view={step} />
  return <PersonalizeStep view={step} />
}
