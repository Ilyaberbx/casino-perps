import { AiMascot } from '@/modules/shared/components/ai-marker'
import styles from './account-modal.module.css'
import type { AgentWalletRowProps } from './account-modal.types'

/**
 * The read-only, **uncounted** Agent Wallet row (PRD-0006 UI-5, G-6). Visually
 * separated from the user wallets (it is never part of `me.wallets` and is not
 * counted toward the 4-wallet cap). Shows the mascot-marked identity and the live
 * Agent Balance (USDC). No select, no removal: the Agent Wallet cannot be selected
 * or removed. It does carry an `Export private key` affordance (ADR-0076 D-5),
 * enabled only once the Agent Wallet is user-owned (`agent.isExportable`); rendered
 * disabled until then.
 */
export function AgentWalletRow({ agent }: AgentWalletRowProps) {
  return (
    <li data-testid="wallet-row-agent" className={styles.agentRow}>
      <AiMascot size={28} animated className={styles.agentGlyph} />
      <span className={styles.walletRowIdentity}>
        <span className={styles.walletRowAddress}>
          {agent.truncatedAddress ?? 'Agent Wallet'}
        </span>
        <span className={styles.walletRowSource}>Agent · {agent.balanceDisplay}</span>
      </span>
      {agent.isExportable && (
        <button
          type="button"
          className={styles.agentTopUp}
          data-testid="agent-export"
          onClick={agent.onExport}
        >
          Export key
        </button>
      )}
    </li>
  )
}
