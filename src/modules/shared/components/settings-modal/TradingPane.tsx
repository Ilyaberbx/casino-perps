import { SegmentedControl } from '../segmented-control'
import styles from './settings-modal.module.css'
import {
  TRADING_MODE_FIELD_DESCRIPTION,
  TRADING_MODE_FIELD_LABEL,
  TRADING_MODE_OPTIONS,
} from './settings-modal.constants'
import type { TradingPaneProps } from './settings-modal.types'

/**
 * Dumb Trading section: the global Simple / Pro trade-layout toggle. Writes
 * through `useTradingMode().setMode` via the parent hook.
 */
export function TradingPane({ tradingMode, onSelectTradingMode }: TradingPaneProps) {
  return (
    <div className={styles.section}>
      <div className={styles.field}>
        <h3 className={styles.fieldLabel}>{TRADING_MODE_FIELD_LABEL}</h3>
        <p className={styles.fieldDescription}>{TRADING_MODE_FIELD_DESCRIPTION}</p>
        <SegmentedControl
          options={TRADING_MODE_OPTIONS}
          value={tradingMode}
          onChange={onSelectTradingMode}
          ariaLabel="Trade layout"
        />
      </div>
    </div>
  )
}
