import styles from './account-dock.module.css'
import { PlaceholderMessage } from '@/modules/shared/components/placeholder-message'
import { DisconnectedTablePlaceholder } from '@/modules/account'
import { panelClassName } from './account-dock.utils'
import type { DockPanelProps } from './account-dock.types'

const CAP_UNSUPPORTED_MESSAGE = 'This venue does not expose this data.'

// One tab panel: owns the visibility class, the `tabpanel` role, the
// capability gate (unsupported message), and the wallet gate. Keeps the parent
// AccountDock declarative — one <DockPanel> per tab — and under the 200-line cap.
export function DockPanel({
  isActive,
  ariaLabel,
  hasCapability,
  connectMessage,
  children,
}: DockPanelProps) {
  return (
    <div
      className={panelClassName(styles.panel, styles.panelHidden, isActive)}
      role="tabpanel"
      aria-label={ariaLabel}
    >
      {hasCapability ? (
        <DisconnectedTablePlaceholder message={connectMessage}>
          {children}
        </DisconnectedTablePlaceholder>
      ) : (
        <PlaceholderMessage message={CAP_UNSUPPORTED_MESSAGE} />
      )}
    </div>
  )
}
