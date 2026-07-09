import { useState } from 'react'
import { Modal } from '@/modules/shared/components/modal'
import { SegmentedControl } from '@/modules/shared/components/segmented-control'
import styles from './fee-schedule-modal.module.css'
import type { FeeScheduleModalProps, MarketType } from './fee-schedule-modal.types'
import { MARKET_TYPE_OPTIONS } from './fee-schedule-modal.constants'
import {
  formatNotionalCutoff,
  formatPercent,
  isActiveTierRow,
} from './fee-schedule-modal.utils'
import { useFeeScheduleModal } from './use-fee-schedule-modal'

export function FeeScheduleModal({ isOpen, onClose }: FeeScheduleModalProps) {
  const schedule = useFeeScheduleModal()
  const [marketType, setMarketType] = useState<MarketType>('spot')

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Fee Schedule"
      title="Fee Schedule"
      /* Stay mounted so the fee-schedule subscription is already populated before
         the user opens it (issue #267). Without this the modal remounts on every
         tap and renders one empty/zero frame — the subscribe runs in a post-paint
         effect — before the data settles, which reads as a flicker. */
      keepMounted
    >
      {/* Body renders only while open — `keepMounted` keeps THIS component (and
         its subscription via `useFeeScheduleModal`) alive so the data is warm,
         but the heavy schedule table stays out of the DOM while closed (mirrors
         the MarketSelectionWindow pattern). On open the data is already present,
         so no empty-frame flicker. */}
      {isOpen ? (
      <>
      <section className={styles.section}>
        <h3 className={styles.sectionHeading}>Referral Discount</h3>
        {schedule.activeReferralDiscount > 0 ? (
          <span
            className={`${styles.badge} ${styles.badgeActive}`}
            data-testid="active-referral-discount"
          >
            {formatPercent(schedule.activeReferralDiscount)}
          </span>
        ) : (
          <span className={styles.badge}>No referral discount</span>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionHeading}>Staking Discount</h3>
        {schedule.activeStakingDiscount.discount > 0 ? (
          <span
            className={`${styles.badge} ${styles.badgeActive}`}
            data-testid="active-staking-discount"
          >
            {formatPercent(schedule.activeStakingDiscount.discount)}
          </span>
        ) : (
          <span className={styles.badge}>No stake</span>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionHeading}>Maker Rebate</h3>
        <span className={styles.badge}>No rebate</span>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionHeading}>Volume Tier</h3>
        <div className={styles.toggleRow}>
          <SegmentedControl<MarketType>
            options={MARKET_TYPE_OPTIONS}
            value={marketType}
            onChange={setMarketType}
            ariaLabel="Market Type"
          />
        </div>
        <table className={styles.table} data-testid="volume-tier-table">
          <thead>
            <tr>
              <th>Tier</th>
              <th>14 Day Volume</th>
              <th>Taker*</th>
              <th>Maker*</th>
            </tr>
          </thead>
          <tbody>
            {schedule.volumeTiers.map((row, i) => {
              const active = isActiveTierRow(row, marketType, schedule)
              const taker = marketType === 'spot' ? row.spotTaker : row.perpsTaker
              const maker = marketType === 'spot' ? row.spotMaker : row.perpsMaker
              return (
                <tr
                  key={row.key}
                  data-testid={`volume-tier-row-${row.key}`}
                  data-active={active ? 'true' : 'false'}
                  className={active ? styles.tableRowActive : ''}
                >
                  <td>{row.label}</td>
                  <td>{formatNotionalCutoff(i, row.notionalCutoff)}</td>
                  <td>{formatPercent(taker)}</td>
                  <td>{formatPercent(maker)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className={styles.footnote}>* Rates given after referral discounts.</p>
      </section>
      </>
      ) : null}
    </Modal>
  )
}
