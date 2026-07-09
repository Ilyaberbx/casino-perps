import styles from './window-selector.module.css'
import type { WindowSelectorProps } from './window-selector.types'
import { WINDOW_OPTIONS } from './window-selector.constants'
import { WindowOption } from './WindowOption'

export function WindowSelector({ window, onSelect }: WindowSelectorProps) {
  return (
    <div className={styles.root} role="tablist" aria-label="Window selector">
      {WINDOW_OPTIONS.map((option) => (
        <WindowOption
          key={option}
          window={option}
          isActive={option === window}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
