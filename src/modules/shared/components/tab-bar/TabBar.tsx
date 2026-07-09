import styles from './tab-bar.module.css'
import { useTabBar } from './use-tab-bar'
import type { TabBarProps } from './tab-bar.types'

export function TabBar<TValue extends string>({
  tabs,
  value,
  onChange,
  fitted = false,
  grow = false,
  wrap = false,
  size = 'md',
  ariaLabel,
  className,
}: TabBarProps<TValue>) {
  const { listRef, indicatorStyle } = useTabBar({ value, fitted, tabCount: tabs.length })

  const listClass = [
    styles.list,
    fitted ? styles.listFitted : null,
    grow ? styles.listGrow : null,
    wrap ? styles.listWrap : null,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={listRef} className={listClass} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const isActive = tab.value === value
        const tabClass = [
          styles.tab,
          size === 'sm' ? styles.sizeSm : null,
          isActive ? styles.tabActive : null,
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={tab.ariaLabel}
            disabled={tab.disabled}
            className={tabClass}
            onClick={() => {
              if (!isActive) onChange(tab.value)
            }}
          >
            {tab.label}
          </button>
        )
      })}
      {fitted && (
        <span className={styles.indicator} style={indicatorStyle ?? undefined} aria-hidden="true" />
      )}
    </div>
  )
}
