import { CopyableAddress } from '@/modules/shared/components/copyable-address'
import styles from './deposit-flow.module.css'
import { AGENT_DEPOSIT_QR_SIZE } from './deposit-flow.constants'
import type { DepositFlowDeps } from './deposit-flow.types'

/**
 * Dumb deposit body for the Agent Balance on Base. Receive-only: it surfaces the
 * Agent Wallet receive address + QR for direct USDC sends. Funding happens by
 * sending USDC on Base to this address — there is no in-app fund-from-connected-
 * wallet transfer. Stateless, so no smart hook.
 */
export function DepositFlow({ agentWalletAddress }: DepositFlowDeps) {
  return (
    <div className={styles.flow} aria-label="Deposit to Agent Balance">
      <p className={styles.lead}>
        Send USDC on Base (8453) to your Agent Wallet, or scan the code below.
      </p>

      {agentWalletAddress === null ? (
        <p className={styles.muted}>Agent Wallet not provisioned yet.</p>
      ) : (
        <CopyableAddress address={agentWalletAddress} qrSize={AGENT_DEPOSIT_QR_SIZE} />
      )}
    </div>
  )
}
