import { ConnectWalletGateButton } from '@/modules/account'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './agent-balance-actions.module.css'
import { useAgentBalanceActions } from './use-agent-balance-actions'
import { MANAGE_AGENT_WALLET_LABEL } from './agent-balance-actions.constants'

/**
 * The Agent Balance tile actions. In Pro mode: the Deposit / Withdraw / Signing
 * entry points, each opening the centred `<AgentWalletModal>` on its flow. In
 * Simple mode: a single "Manage Agent Wallet" button opening the same modal on
 * its first flow (#273). Both modes drive one surface — the Pro side sheet was
 * removed. Wallet-gated per `wallet-gate.md` mode-3
 * (`<ConnectWalletGateButton>`): disconnected → the affordances are absent.
 * Dumb body: the Pro/Simple split is resolved in `useAgentBalanceActions`.
 */
export function AgentBalanceActions() {
  const { isSimple, openDeposit, openWithdraw, openDelegation } = useAgentBalanceActions()

  if (isSimple) {
    return (
      <ConnectWalletGateButton>
        <div className={styles.actions}>
          <PixelButton
            type="button"
            variant="accentFilled"
            size="sm"
            elevated
            onClick={openDeposit}
          >
            {MANAGE_AGENT_WALLET_LABEL}
          </PixelButton>
        </div>
      </ConnectWalletGateButton>
    )
  }

  return (
    <ConnectWalletGateButton>
      <div className={styles.actions}>
        <PixelButton
          type="button"
          variant="accentFilled"
          size="sm"
          elevated
          onClick={openDeposit}
        >
          Deposit
        </PixelButton>
        <PixelButton
          type="button"
          variant="default"
          size="sm"
          onClick={openWithdraw}
        >
          Withdraw
        </PixelButton>
        <PixelButton
          type="button"
          variant="default"
          size="sm"
          onClick={openDelegation}
        >
          Signing
        </PixelButton>
      </div>
    </ConnectWalletGateButton>
  )
}
