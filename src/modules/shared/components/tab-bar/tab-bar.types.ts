import type { CSSProperties, ReactNode, RefObject } from 'react'

export interface UseTabBarOptions {
  /** The selected tab value — re-measures the indicator when it changes. */
  value: string
  /** Only the fitted strip slides a measured indicator. */
  fitted: boolean
  /** Tab count — re-measures when the tab set changes. */
  tabCount: number
}

export interface UseTabBarReturn {
  /** Attach to the `role="tablist"` strip; the measurement origin. */
  listRef: RefObject<HTMLDivElement | null>
  /** Inline `transform` + `width` for the sliding indicator, or `null` until measured. */
  indicatorStyle: CSSProperties | null
}

export interface TabBarTab<TValue extends string> {
  value: TValue
  label: ReactNode
  ariaLabel?: string
  disabled?: boolean
}

export interface TabBarProps<TValue extends string> {
  tabs: ReadonlyArray<TabBarTab<TValue>>
  value: TValue
  onChange: (value: TValue) => void
  /** Equal-width tabs that fill the strip (each tab `flex: 1`). */
  fitted?: boolean
  /**
   * Let tabs grow to fill the strip's width (`flex: 1 0 auto`) while keeping
   * their intrinsic minimum: when the tabs fit, they stretch edge-to-edge; when
   * they overflow they keep natural size and the strip scrolls (vs. `fitted`,
   * which lets them shrink/squash). Use for the 9-tab account dock so it fills
   * a wide container yet still scrolls when narrow.
   */
  grow?: boolean
  /**
   * Wrap overflowing tabs onto a second row instead of putting the strip in a
   * horizontal scroll container (the default `overflow-x: auto`). Use for strips
   * with many tabs that should all stay reachable without sideways scrolling —
   * e.g. the 9-tab account dock.
   */
  wrap?: boolean
  /** Visual size — `md` = portfolio default; `sm` = denser trading panels. */
  size?: 'sm' | 'md'
  ariaLabel?: string
  className?: string
}
