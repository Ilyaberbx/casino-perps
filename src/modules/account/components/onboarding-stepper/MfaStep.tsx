import { PixelButton } from '@/modules/shared/components/pixel-button/PixelButton'
import styles from './onboarding-stepper.module.css'
import type { MfaStepView } from './onboarding-stepper.types'

export function MfaStep({ view }: { view: MfaStepView }) {
  return (
    <div className={styles.form}>
      <p className={styles.prose}>
        Add two-factor authentication (authenticator app). You can skip this and add one later.
      </p>
      <div className={styles.actions}>
        <PixelButton
          type="button"
          variant="accentFilled"
          fullWidth
          disabled={view.isEnrolling}
          onClick={() => void view.onSetup()}
        >
          {view.isEnrolling ? 'Setting up…' : 'Set up 2FA'}
        </PixelButton>
        <PixelButton type="button" variant="default" fullWidth onClick={view.onSkip}>
          Skip
        </PixelButton>
      </div>
    </div>
  )
}
