import styles from '../portfolio-tile-column.module.css'
import { useFeesTile } from './use-fees-tile'
import { FEES_MARKET_OPTIONS } from './fees-tile.constants'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import { IconSelect } from '@/modules/shared/components/icon-select'
import { ValueSkeleton } from '@/modules/shared/components/value-skeleton'
import { FeeScheduleModal } from '../../fee-schedule-modal'

export function FeesTile() {
  const {
    state,
    isSimple,
    selectedMarket,
    onSelectMarket,
    selectedMarketFees,
    isModalOpen,
    onViewFeeSchedule,
    onCloseModal,
  } = useFeesTile()

  if (state.kind === 'unsupported') {
    return (
      <div className={styles.tile} aria-label="Fees (Taker / Maker)">
        <span className={styles.tileLabel}>Fees (Taker / Maker)</span>
        <span className={styles.tileUnsupported}>
          Not supported on this venue
        </span>
      </div>
    )
  }

  if (state.kind === 'loading') {
    return (
      <div className={styles.tile} aria-label="Fees (Taker / Maker)">
        <span className={styles.tileLabel}>Fees (Taker / Maker)</span>
        <div className={styles.feeRows}>
          <ValueSkeleton ariaLabel="Loading fees" width="60%" height={12} />
          <ValueSkeleton width="48%" height={12} />
        </div>
      </div>
    )
  }

  if (isSimple && selectedMarketFees !== null) {
    return (
      <div className={styles.tile} aria-label="Fees (Taker / Maker)">
        <div className={styles.feeCompactHead}>
          <span className={styles.tileLabel}>Fees (Taker / Maker)</span>
          <IconSelect
            options={FEES_MARKET_OPTIONS}
            value={selectedMarket}
            onChange={onSelectMarket}
            ariaLabel="Fees market"
            className={styles.feeMarketSelect}
          />
        </div>
        <span className={styles.feeRowValue}>
          {selectedMarketFees.taker} / {selectedMarketFees.maker}
        </span>
        <PixelButton
          variant="accentFilled"
          size="sm"
          onClick={onViewFeeSchedule}
        >
          View Fee Schedule
        </PixelButton>
        <FeeScheduleModal isOpen={isModalOpen} onClose={onCloseModal} />
      </div>
    )
  }

  return (
    <div className={styles.tile} aria-label="Fees (Taker / Maker)">
      <span className={styles.tileLabel}>Fees (Taker / Maker)</span>
      <div className={styles.feeRows}>
        <div className={styles.feeRow}>
          <span className={styles.feeRowLabel}>Perps</span>
          <span className={styles.feeRowValue}>
            {state.perpsTakerFee} / {state.perpsMakerFee}
          </span>
        </div>
        <div className={styles.feeRow}>
          <span className={styles.feeRowLabel}>Spot</span>
          <span className={styles.feeRowValue}>
            {state.spotTakerFee} / {state.spotMakerFee}
          </span>
        </div>
      </div>
      <PixelButton variant="accentFilled" size="sm" onClick={onViewFeeSchedule}>
        View Fee Schedule
      </PixelButton>
      <FeeScheduleModal isOpen={isModalOpen} onClose={onCloseModal} />
    </div>
  )
}
