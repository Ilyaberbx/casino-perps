import { useState } from 'react'
import { MIN_LEVERAGE } from '../leverage-margin/leverage-margin.constants'
import type { MultiplierControlProps } from './casino-trade.types'
import styles from './casino-trade.module.css'

/**
 * MULTIPLIER 10x + slider. The slider tracks a local draft while dragging and
 * commits (`onChange`, which signs the venue set-leverage) only on release, so
 * a drag does not fire a signature per tick. A leverage applied elsewhere
 * reseeds the draft via the render-time previous-value tracker (React 19 idiom).
 */
export function MultiplierControl({ leverage, maxLeverage, onChange }: MultiplierControlProps) {
  const [draft, setDraft] = useState(leverage)
  const [lastLeverage, setLastLeverage] = useState(leverage)
  if (lastLeverage !== leverage) {
    setLastLeverage(leverage)
    setDraft(leverage)
  }

  const commit = () => {
    if (draft === leverage) return
    onChange(draft)
  }

  return (
    <div className={styles.multiplier} data-testid="multiplier-control">
      <div className={styles.multiplierHead}>
        <span className={styles.multiplierLabel}>MULTIPLIER</span>
        <span className={styles.multiplierValue}>{draft}x</span>
      </div>
      <input
        type="range"
        className={styles.multiplierSlider}
        min={MIN_LEVERAGE}
        max={maxLeverage}
        step={1}
        value={draft}
        aria-label="Multiplier"
        aria-valuetext={`${draft}x`}
        onChange={(event) => setDraft(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
    </div>
  )
}
