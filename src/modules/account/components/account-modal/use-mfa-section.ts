import { useAuth } from '../../providers/auth-provider'
import { useMfaEnrollment } from '../../hooks/use-mfa-enrollment'
import type { MfaSectionView } from './account-modal.types'

/**
 * Drives the 2FA section. Binary single-factor state, with the "set" signal
 * derived from Privy (`AuthState.hasMfa` — a `'totp'` factor in `user.mfaMethods`;
 * no server-side MFA flag). Unset → an enrol CTA that calls `enrollMfa`, toasting
 * on failure and staying (skippable-consistent with onboarding). Set → an "on"
 * confirmation. No list / remove / multiple in V1.
 */
export function useMfaSection(): MfaSectionView {
  const { hasMfa, enrollMfa } = useAuth()
  const { isEnrolling, onSetup } = useMfaEnrollment(enrollMfa, 'You can try again from your account.')

  if (hasMfa) return { kind: 'set' }
  return { kind: 'unset', isEnrolling, onSetup }
}
