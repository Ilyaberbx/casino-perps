import styles from '../portfolio-tile-column.module.css'
import { useVolumeTile } from './use-volume-tile'
import { PixelButton } from '../../../../shared/components/pixel-button'
import { ValueSkeleton } from '@/modules/shared/components/value-skeleton'
import { VolumeHistoryModal } from '../../volume-history-modal'

export function VolumeTile() {
  const { volumeDisplay, isLoading, isModalOpen, onViewVolume, onCloseModal } = useVolumeTile()

  return (
    <div className={`${styles.tile} ${styles.volumeTile}`} aria-label="14 Day Volume">
      <div className={styles.volumeHead}>
        <span className={styles.tileLabel}>14 Day Volume</span>
        {isLoading ? (
          <ValueSkeleton ariaLabel="Loading 14 day volume" width={90} height={18} />
        ) : (
          <span className={styles.tileBody}>{volumeDisplay}</span>
        )}
      </div>
      <PixelButton variant="accentFilled" size="sm" onClick={onViewVolume}>
        View Volume
      </PixelButton>
      <VolumeHistoryModal isOpen={isModalOpen} onClose={onCloseModal} />
    </div>
  )
}
