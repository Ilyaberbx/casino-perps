import { ConnectWalletGateButton } from '@/modules/account'
import { PixelButton } from '../pixel-button'
import styles from './manage-funds-pills.module.css'
import { MANAGE_FUNDS_SINGLE_LABEL } from '../../providers/manage-funds-provider'
import { useManageFundsPills } from './use-manage-funds-pills'

/**
 * Header funds-action row. In Pro mode it renders the five `PixelButton` pills
 * (Perps⇄Spot, EVM⇄Core, Send, Deposit, Withdraw), each deep-linking its Manage
 * Funds tab via `useManageFunds().open(tab)`. In Simple mode it collapses to a
 * single "Manage Funds" button that opens the modal on the default tab (#272).
 * Renders nothing when the active venue exposes none of deposit / transfer /
 * withdraw. Wallet-gated as a whole via `<ConnectWalletGateButton>` (mode-3 of
 * `wallet-gate.md`): disconnected → nothing; connected → the affordance. The
 * Pro/Simple split is resolved in `useManageFundsPills`.
 */
export function ManageFundsPills() {
  const { hasAnyCapability, isSimple, pills, simpleTab, onOpen } = useManageFundsPills()

  if (!hasAnyCapability) return null

  if (isSimple) {
    return (
      <ConnectWalletGateButton>
        <div className={styles.row} role="group" aria-label="Manage funds">
          <PixelButton
            type="button"
            variant="default"
            size="sm"
            elevated
            onClick={() => onOpen(simpleTab)}
          >
            {MANAGE_FUNDS_SINGLE_LABEL}
          </PixelButton>
        </div>
      </ConnectWalletGateButton>
    )
  }

  return (
    <ConnectWalletGateButton>
      <div className={styles.pills} role="group" aria-label="Manage funds">
        {pills.map((pill) => (
          <PixelButton
            key={pill.id}
            type="button"
            variant="default"
            size="sm"
            elevated
            onClick={() => onOpen(pill.id)}
          >
            {pill.label}
          </PixelButton>
        ))}
      </div>
    </ConnectWalletGateButton>
  )
}
