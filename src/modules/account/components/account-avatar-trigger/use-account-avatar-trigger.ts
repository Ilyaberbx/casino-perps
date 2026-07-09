import { useOnboardingFlow } from '../../hooks/use-onboarding-flow'
import { useAccountModal } from '../../providers/account-modal-provider'
import { selectNativeWallet } from '../../account.utils'
import type { AccountAvatarTriggerView } from './account-avatar-trigger.types'

/**
 * Drives the header account entry point (PRD-0006 UI-2). The trigger only mounts
 * once the wallet is authenticated (`app/` renders Connect otherwise), so a
 * non-`ready` onboarding FSM here means "authenticated, still resolving" → a
 * `loading` skeleton (rather than a blank header that pops the button in). It
 * resolves to a `ready` view once the FSM reaches `ready`; a `ready` `Me` with
 * no Native wallet (malformed) stays `hidden`. The trigger renders a `User` glyph
 * (not the wallet gradient), so it carries only the handle; clicking opens the
 * Account Modal directly.
 */
export function useAccountAvatarTrigger(): AccountAvatarTriggerView {
  const flow = useOnboardingFlow()
  const { open } = useAccountModal()

  if (flow.kind !== 'ready') return { kind: 'loading' }

  const nativeWallet = selectNativeWallet(flow.me)
  if (nativeWallet === null) return { kind: 'hidden' }

  return {
    kind: 'ready',
    handle: flow.me.user.handle,
    onOpen: open,
  }
}
