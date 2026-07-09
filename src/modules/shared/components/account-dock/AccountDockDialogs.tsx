import { BulkActionConfirm } from './BulkActionConfirm'
import { PnlCardModal } from '@/modules/shared/components/pnl-card'
import type { AccountDockDialogsProps } from './account-dock.types'

// The dock-level modal cluster rendered outside the tab panels: the bulk-action
// confirm dialog and the shareable PnL card. Dumb — fed entirely by the parent's
// `useAccountDock` state.
export function AccountDockDialogs({
  pendingBulkAction,
  bulkActionCount,
  isMobile,
  shareView,
  onConfirmBulkAction,
  onDismissBulkAction,
  onCloseShare,
}: AccountDockDialogsProps) {
  return (
    <>
      <BulkActionConfirm
        action={pendingBulkAction}
        isMobile={isMobile}
        count={bulkActionCount}
        onConfirm={onConfirmBulkAction}
        onCancel={onDismissBulkAction}
      />
      <PnlCardModal view={shareView} isMobile={isMobile} onClose={onCloseShare} />
    </>
  )
}
