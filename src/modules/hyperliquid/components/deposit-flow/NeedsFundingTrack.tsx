import { Callout } from '@/modules/shared/components/callout'
import { CopyableAddress } from '@/modules/shared/components/copyable-address'
import styles from './deposit-flow.module.css'
import { formatUsd } from '@/modules/shared/utils/format-number'
import { DEPOSIT_COPY, DEPOSIT_QR_SIZE } from './deposit-flow.constants'
import type { NeedsFundingTrackProps } from './deposit-flow.types'

/**
 * `needs-funding` track: the receive-address surface. A pixel QR + copyable
 * truncated address of the user's OWN Arbitrum address, a live USDC balance
 * read-out (ticks up as funds arrive), and the persistent self-custody warning.
 * The deposit affordance is intentionally absent until the live balance crosses
 * the minimum and the machine auto-advances to `ready`.
 */
export function NeedsFundingTrack({ address, walletUsdc }: NeedsFundingTrackProps) {
  return (
    <div className={styles.track}>
      <CopyableAddress address={address} qrSize={DEPOSIT_QR_SIZE} />
      <div className={styles.balanceRow}>
        <span>Balance</span>
        <span className={styles.balanceValue}>{formatUsd(walletUsdc)}</span>
      </div>
      <Callout variant="warning" label={DEPOSIT_COPY.selfCustodyLabel}>
        {DEPOSIT_COPY.selfCustodyProse}
      </Callout>
    </div>
  )
}
