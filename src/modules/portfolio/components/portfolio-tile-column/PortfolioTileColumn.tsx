import styles from './portfolio-tile-column.module.css'
import { VolumeTile } from './volume-tile/VolumeTile'
import { FeesTile } from './fees-tile/FeesTile'

export function PortfolioTileColumn() {
  return (
    <div className={styles.root}>
      <VolumeTile />
      <FeesTile />
    </div>
  )
}
