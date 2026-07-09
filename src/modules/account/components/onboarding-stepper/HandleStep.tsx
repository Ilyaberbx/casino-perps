import { PixelButton } from '@/modules/shared/components/pixel-button/PixelButton'
import styles from './onboarding-stepper.module.css'
import type { HandleStepView } from './onboarding-stepper.types'
import { availabilityLabel } from './onboarding-stepper.view'

export function HandleStep({ view }: { view: HandleStepView }) {
  const indicator = availabilityLabel(view.availability)
  return (
    <form
      className={styles.form}
      aria-label="Choose handle"
      onSubmit={(e) => {
        e.preventDefault()
        void view.onContinue()
      }}
    >
      <p className={styles.prose}>Choose a unique handle. This is permanent.</p>
      <label className={styles.label}>
        Handle
        <input
          className={view.formatError !== null ? `${styles.input} ${styles.inputInvalid}` : styles.input}
          type="text"
          value={view.handle}
          autoComplete="off"
          aria-invalid={view.formatError !== null}
          onChange={(e) => view.onHandleChange(e.target.value)}
        />
      </label>
      {view.formatError !== null ? (
        <p className={styles.fieldError}>{view.formatError}</p>
      ) : indicator !== null ? (
        <p className={view.availability === 'available' ? styles.fieldOk : styles.fieldHint}>
          {indicator}
        </p>
      ) : null}
      {view.showInviteField ? (
        <label className={styles.label}>
          Invite code
          <input
            className={view.inviteError !== null ? `${styles.input} ${styles.inputInvalid}` : styles.input}
            type="text"
            value={view.inviteCode}
            autoComplete="off"
            autoCapitalize="characters"
            aria-invalid={view.inviteError !== null}
            onChange={(e) => view.onInviteCodeChange(e.target.value)}
          />
        </label>
      ) : null}
      {view.inviteError !== null ? (
        <p className={styles.fieldError}>{view.inviteError}</p>
      ) : null}
      <PixelButton type="submit" variant="accentFilled" fullWidth disabled={!view.canContinue}>
        {view.isSubmitting ? 'Saving…' : 'Continue'}
      </PixelButton>
    </form>
  )
}
