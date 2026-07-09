import { User } from 'lucide-react'
import { ValueSkeleton } from '@/modules/shared/components/value-skeleton'
import { useAccountAvatarTrigger } from './use-account-avatar-trigger'
import styles from './account-avatar-trigger.module.css'

const AVATAR_SIZE_PX = 24
const ICON_SIZE_PX = 16

/**
 * The header account entry point (PRD-0006 UI-2): a pixel-framed account glyph +
 * handle that opens the Account Modal. Uses a `User` icon (ADR-0067) — distinct
 * from the wallet switcher's gradient avatar so the two header controls don't
 * read as the same chip. Shows a skeleton in the trigger's exact footprint while
 * the account resolves (authenticated but loading), so the button reveals in
 * place rather than popping in. Hidden only when the resolved account is
 * malformed (no Native wallet).
 */
export function AccountAvatarTrigger() {
  const view = useAccountAvatarTrigger()
  if (view.kind === 'hidden') return null

  if (view.kind === 'loading') {
    return (
      <div className={styles.triggerSkeleton} aria-hidden="true" data-testid="account-avatar-skeleton">
        <ValueSkeleton ariaLabel="Loading account" width={AVATAR_SIZE_PX} height={AVATAR_SIZE_PX} />
        <ValueSkeleton width={88} height={11} />
      </div>
    )
  }

  return (
    <button
      type="button"
      data-testid="account-avatar-trigger"
      className={styles.trigger}
      onClick={view.onOpen}
      aria-label="Open account"
    >
      <span className={styles.iconFrame} data-testid="account-avatar-icon" aria-hidden="true">
        <User size={ICON_SIZE_PX} />
      </span>
      <span data-testid="account-avatar-handle" className={styles.handle}>
        {view.handle}
      </span>
    </button>
  )
}
