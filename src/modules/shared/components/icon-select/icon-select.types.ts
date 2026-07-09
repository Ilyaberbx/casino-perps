import type { KeyboardEvent, ReactNode, RefObject } from 'react'

export interface IconSelectOption {
  value: string
  label: string
  /**
   * Optional — rendered before the label in both the trigger and the list row.
   * Omit to use the primitive as a label-only pixel dropdown (e.g. tick selector).
   */
  icon?: ReactNode
  /**
   * Optional — section label. When consecutive options share a `group`, a
   * non-interactive header row renders above the first option of each section
   * (e.g. the chart timeframe dropdown's MINUTES / HOURS / DAYS bands). Omit on
   * every option to keep the list flat.
   */
  group?: string
  /**
   * Optional — a non-selectable option (e.g. a "coming soon" venue/agent).
   * Rendered muted with `aria-disabled`; keyboard navigation skips it and a
   * click never fires `onChange`. Default false.
   */
  disabled?: boolean
}

export interface IconSelectProps {
  options: ReadonlyArray<IconSelectOption>
  value: string
  onChange: (value: string) => void
  /** Accessible name for the trigger button + listbox. */
  ariaLabel: string
  className?: string
  /**
   * Collapse the trigger to the selected option's icon + caret only (label
   * hidden), for tight chrome like the mobile app-shell header. The accessible
   * name stays on `ariaLabel` and the selected label is surfaced via `title`, so
   * a11y is unaffected. The dropdown list still shows labels. Default false.
   */
  iconOnly?: boolean
}

export interface UseIconSelectParams {
  options: ReadonlyArray<IconSelectOption>
  value: string
  onChange: (value: string) => void
}

export interface UseIconSelectReturn {
  isOpen: boolean
  selectedOption: IconSelectOption | undefined
  activeIndex: number
  triggerRef: RefObject<HTMLButtonElement | null>
  listRef: RefObject<HTMLUListElement | null>
  listboxId: string
  optionId: (index: number) => string
  onTriggerClick: () => void
  onTriggerKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
  onListKeyDown: (event: KeyboardEvent<HTMLUListElement>) => void
  onOptionClick: (index: number) => void
}
