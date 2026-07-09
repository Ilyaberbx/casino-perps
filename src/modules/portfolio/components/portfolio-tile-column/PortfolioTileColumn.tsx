import styles from './portfolio-tile-column.module.css'
import { VolumeTile } from './volume-tile/VolumeTile'
import { FeesTile } from './fees-tile/FeesTile'
import { AgentBalanceTile } from '@/modules/agent-balance'

export function PortfolioTileColumn() {
  return (
    <div className={styles.root}>
      <AgentBalanceTile />
      <VolumeTile />
      <FeesTile />
    </div>
  )
}
