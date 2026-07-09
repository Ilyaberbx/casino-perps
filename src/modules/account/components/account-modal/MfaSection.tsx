import { PixelButton } from '@/modules/shared/components/pixel-button'
import { useMfaSection } from './use-mfa-section'
import styles from './account-modal.module.css'

/**
 * 2FA section. Binary single-factor state: unset → enrol CTA; set → "on"
 * confirmation. No list / remove / multiple in V1.
 */
export function MfaSection() {
  const view = useMfaSection()

  if (view.kind === 'set') {
    return (
      <section data-testid="account-section-mfa" className={styles.section}>
        <div data-testid="mfa-on" className={styles.mfaOn}>
          <span className={styles.mfaGlyph} aria-hidden="true">
            ✓
          </span>
          <div>
            <p className={styles.mfaTitle}>Two-factor authentication on</p>
            <p className={styles.mfaBody}>
              An authenticator app is linked to your account for stronger sign-in.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section data-testid="account-section-mfa" className={styles.section}>
      <p className={styles.mfaBody}>
        Add two-factor authentication with an authenticator app — a stronger,
        phishing-resistant layer on top of your email.
      </p>
      <PixelButton
        type="button"
        variant="accent"
        data-testid="mfa-setup"
        disabled={view.isEnrolling}
        onClick={view.onSetup}
      >
        {view.isEnrolling ? 'Setting up…' : 'Set up 2FA'}
      </PixelButton>
    </section>
  )
}
