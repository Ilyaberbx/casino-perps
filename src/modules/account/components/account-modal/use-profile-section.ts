import { useCallback } from 'react'
import { useAuth } from '../../providers/auth-provider'
import { useOnboardingFlow } from '../../hooks/use-onboarding-flow'
import { selectNativeWallet } from '../../account.utils'
import type { ProfileSectionView } from './account-modal.types'

/**
 * Drives the Profile section (PRD-0006 UI-3). Surfaces read-only email + handle
 * from the resolved `Me`, the Native Wallet address that seeds the avatar, and
 * Log out. The theme switch now lives in Settings → Appearance (#256), reachable
 * on mobile via the Settings footer cell. Returns `null` only in the unreachable
 * case where the modal is shown before the FSM reaches `ready`.
 */
export function useProfileSection(): ProfileSectionView | null {
  const { logout } = useAuth()
  const flow = useOnboardingFlow()
  const onLogout = useCallback(() => {
    void logout()
  }, [logout])

  if (flow.kind !== 'ready') return null
  const nativeWallet = selectNativeWallet(flow.me)
  if (nativeWallet === null) return null

  return {
    email: flow.me.user.email,
    handle: flow.me.user.handle,
    nativeAddress: nativeWallet.address,
    iconUrl: flow.me.user.iconUrl,
    onLogout,
  }
}
