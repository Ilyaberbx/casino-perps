import { PixelButton } from '@/modules/shared/components/pixel-button/PixelButton'
import { OtpInput } from './OtpInput'
import styles from './onboarding-stepper.module.css'
import type { OtpStepView } from './onboarding-stepper.types'

export function OtpStep({ view }: { view: OtpStepView }) {
  return (
    <form
      className={styles.form}
      aria-label="Verify code"
      onSubmit={(e) => {
        e.preventDefault()
        void view.onSubmit(view.code)
      }}
    >
      <p className={styles.prose}>Enter the 6-digit code sent to {view.email}.</p>
      <OtpInput
        value={view.code}
        onChange={view.onCodeChange}
        onComplete={view.onSubmit}
        disabled={view.isVerifying}
      />
      <PixelButton type="submit" variant="accentFilled" fullWidth disabled={view.isVerifying}>
        {view.isVerifying ? 'Verifying…' : 'Continue'}
      </PixelButton>
      <div className={styles.footerRow}>
        <button type="button" className={styles.linkButton} onClick={view.onBack}>
          Back
        </button>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => void view.onResend()}
          disabled={!view.canResend}
        >
          {view.canResend ? 'Resend code' : `Resend in ${view.resendSeconds}s`}
        </button>
      </div>
    </form>
  )
}
