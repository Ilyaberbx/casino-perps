import { Modal } from '../modal'
import styles from './manage-funds-modal.module.css'
import { ManageFundsNav } from './ManageFundsNav'
import { ManageFundsPane } from './ManageFundsPane'
import { useManageFundsModal } from './use-manage-funds-modal'
import {
  MANAGE_FUNDS_MODAL_ARIA_LABEL,
  MANAGE_FUNDS_MODAL_TITLE,
} from './manage-funds-modal.constants'

/**
 * Dumb host for the Manage Funds modal. Wraps the shared `Modal` (centered,
 * titled) and lays out a two-column shell: a left vertical nav rail
 * (`<ManageFundsNav>`) + a right active-form pane (`<ManageFundsPane>`). On
 * mobile the nav collapses to a top scroll strip (driven by `isMobile`) and the
 * `Modal` primitive already goes full-width/bottom at the same breakpoint. Only
 * the active tab's content mounts — `<ManageFundsPane>` mounts a venue
 * provider/body solely for the selected tab, so no venue state machine is
 * eagerly created.
 */
export function ManageFundsModal() {
  const {
    isOpen,
    activeTab,
    close,
    onSelectTab,
    tabs,
    isMobile,
    deposit,
    transfer,
    withdraw,
    send,
    evmCore,
  } = useManageFundsModal()

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      ariaLabel={MANAGE_FUNDS_MODAL_ARIA_LABEL}
      title={MANAGE_FUNDS_MODAL_TITLE}
    >
      <div className={styles.layout}>
        <ManageFundsNav
          tabs={tabs}
          activeTab={activeTab}
          onSelect={onSelectTab}
          isMobile={isMobile}
        />
        <section className={styles.pane}>
          <ManageFundsPane
            activeTab={activeTab}
            deposit={deposit}
            transfer={transfer}
            withdraw={withdraw}
            send={send}
            evmCore={evmCore}
          />
        </section>
      </div>
    </Modal>
  )
}
