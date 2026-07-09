import { Modal } from '@/modules/shared/components/modal'
import styles from './volume-history-modal.module.css'
import type { VolumeHistoryModalProps } from './volume-history-modal.types'
import { sumVolumeTotals, USD } from './volume-history-modal.utils'
import { useVolumeHistoryModal } from './use-volume-history-modal'

export function VolumeHistoryModal({ isOpen, onClose }: VolumeHistoryModalProps) {
  const history = useVolumeHistoryModal()
  const totals = sumVolumeTotals(history.entries)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Your Volume History"
      title="Your Volume History"
      /* Stay mounted so the volume-history subscription is already populated
         before the user opens it (issue #267). Without this the modal remounts
         on every tap and renders one empty/zero frame — the subscribe runs in a
         post-paint effect — before the data settles, which reads as a flicker. */
      keepMounted
    >
      {/* Body renders only while open — `keepMounted` keeps THIS component (and
         its subscription via `useVolumeHistoryModal`) alive so the data is warm,
         but the heavy table stays out of the DOM while closed (mirrors the
         MarketSelectionWindow pattern). On open the data is already present, so
         no empty-frame flicker. */}
      {isOpen ? (
        <div className={styles.content}>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date (UTC)</th>
                  <th>Exchange Volume</th>
                  <th>Your Weighted Maker Volume</th>
                  <th>Your Weighted Taker Volume</th>
                </tr>
              </thead>
              <tbody>
                <tr className={styles.totalRow} data-testid="volume-history-total">
                  <td>Total</td>
                  <td>{USD.format(totals.exchange)}</td>
                  <td>{USD.format(totals.maker)}</td>
                  <td>{USD.format(totals.taker)}</td>
                </tr>
                {history.entries.map((entry) => (
                  <tr key={entry.date}>
                    <td>{entry.date}</td>
                    <td>{USD.format(entry.exchangeVolume)}</td>
                    <td>{USD.format(entry.userMakerVolume)}</td>
                    <td>{USD.format(entry.userTakerVolume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.footnote}>
            Dates do not include the current day. Perps and spot volume are counted together to
            determine your fee tier, and spot volume counts double toward your fee tier.
          </p>
        </div>
      ) : null}
    </Modal>
  )
}
