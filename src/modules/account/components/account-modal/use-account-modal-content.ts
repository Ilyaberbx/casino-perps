import { useCallback, useEffect, useRef, useState } from 'react'
import { useIsMobile } from '@/modules/shared/hooks/use-is-mobile'
import { useAccountModal } from '../../providers/account-modal-provider'
import { useOnboardingFlow } from '../../hooks/use-onboarding-flow'
import { ACCOUNT_NAV_ITEMS } from './account-modal.constants'
import type { AccountModalView, AccountSection } from './account-modal.types'

/**
 * Drives the Account Modal shell (PRD-0006 UI-2). Owns the active-section state
 * (default `profile`) and the open/close controller (from `useAccountModal`).
 * The desktop sidebar vs. mobile top-tab strip is one nav model rendered two
 * ways — the boundary is `useIsMobile`. Each section's own data/handlers live in
 * that section's smart hook, not here.
 *
 * On the closed→open transition it fires `refreshMe()` (Workstream D) so a
 * server-side Selected-Wallet change made out of band (another device, a manual
 * DB edit) reconciles into the canonical `me` while the modal is open.
 */
export function useAccountModalContent(): AccountModalView {
  const { isOpen, close } = useAccountModal()
  const flow = useOnboardingFlow()
  const isMobile = useIsMobile()
  const [activeSection, setActiveSection] = useState<AccountSection>('profile')

  const refreshMe = flow.kind === 'ready' ? flow.refreshMe : undefined
  const wasOpenRef = useRef(false)
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current
    wasOpenRef.current = isOpen
    if (!justOpened) return
    refreshMe?.()
  }, [isOpen, refreshMe])

  const onSelectSection = useCallback((section: AccountSection) => {
    setActiveSection(section)
  }, [])

  return {
    isOpen,
    isMobile,
    activeSection,
    navItems: ACCOUNT_NAV_ITEMS,
    onClose: close,
    onSelectSection,
  }
}
