import { Modal } from '@/modules/shared/components/modal'
import { DepositFlow } from '../deposit-flow'
import { WithdrawFlow } from '../withdraw-flow'
import { DelegationConsent } from '../delegation-consent'
import { AgentWalletNav } from './AgentWalletNav'
import { useAgentWalletModal } from './use-agent-wallet-modal'
import {
  AGENT_WALLET_MODAL_ARIA_LABEL,
  AGENT_WALLET_MODAL_TITLE,
} from './agent-wallet-modal.constants'
import styles from './agent-wallet-modal.module.css'

/**
 * Simple-mode Agent Wallet surface (#273): a centred modal that reuses the
 * Manage Funds shell (shared `Modal` + left-rail nav + pane) and re-hosts the
 * three existing Agent Balance bodies — Deposit | Withdraw | Signing — as tabs.
 * Distinct from "Manage Funds" (the Agent Wallet is never trading collateral).
 * Only the active tab's body mounts. Dumb body: state lives in
 * `useAgentWalletModal`.
 */
export function AgentWalletModal() {
  const {
    isOpen,
    activeMode,
    isMobile,
    tabs,
    depositDeps,
    withdrawDeps,
    delegationDeps,
    onSelectTab,
    close,
  } = useAgentWalletModal()

  const showDelegation = activeMode === 'delegation' && delegationDeps !== null

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      ariaLabel={AGENT_WALLET_MODAL_ARIA_LABEL}
      title={AGENT_WALLET_MODAL_TITLE}
    >
      <div className={styles.layout}>
        <AgentWalletNav
          tabs={tabs}
          activeMode={activeMode}
          isMobile={isMobile}
          onSelect={onSelectTab}
        />
        <section className={styles.pane}>
          {activeMode === 'deposit' ? <DepositFlow {...depositDeps} /> : null}
          {activeMode === 'withdraw' ? <WithdrawFlow {...withdrawDeps} /> : null}
          {showDelegation ? <DelegationConsent {...delegationDeps} /> : null}
        </section>
      </div>
    </Modal>
  )
}
