import { PixelButton } from '@/modules/shared/components/pixel-button/PixelButton'
import styles from './onboarding-stepper.module.css'
import type { EmailStepView } from './onboarding-stepper.types'

export function EmailStep({ view }: { view: EmailStepView }) {
  return (
    <form
      className={styles.form}
      aria-label="Send code"
      onSubmit={(e) => {
        e.preventDefault()
        void view.onContinue()
      }}
    >
      <p className={styles.prose}>Enter your email to sign in or create an account.</p>
      <label className={styles.label}>
        Email
        <input
          className={view.formatError !== null ? `${styles.input} ${styles.inputInvalid}` : styles.input}
          type="email"
          value={view.email}
          aria-invalid={view.formatError !== null}
          onChange={(e) => view.onEmailChange(e.target.value)}
        />
      </label>
      {view.formatError !== null ? <p className={styles.fieldError}>{view.formatError}</p> : null}
      <PixelButton type="submit" variant="accentFilled" fullWidth disabled={!view.canContinue}>
        {view.isSending ? 'Sending…' : 'Continue'}
      </PixelButton>
    </form>
  )
}
