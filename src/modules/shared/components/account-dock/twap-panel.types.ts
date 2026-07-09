import type { ActiveTwap, Fill } from '@/modules/shared/domain'
import type { UsePaginatedHistoryReturn } from '@/modules/shared/hooks/use-paginated-history.types'
import type { TwapHistoryEntry } from '@/modules/shared/domain'

/** The three sub-tabs of the TWAP panel (trade.xyz parity). */
export type TwapSubTab = 'active' | 'history' | 'fillHistory'

export interface UseTwapPanelReturn {
  subTab: TwapSubTab
  setSubTab: (tab: TwapSubTab) => void
  /** Wall-clock `now` (ms), re-derived each ~1s so the Active rows tick. */
  now: number
  /** Active TWAP rows (snapshot — no pagination). */
  activeTwaps: ReadonlyArray<ActiveTwap>
  areTwapsLoading: boolean
  /** Whether the venue exposes `twapController` (per-row + bulk Cancel). */
  hasTwapController: boolean
  /** Selected active-twap identifiers (multi-select checkboxes). */
  selectedIds: ReadonlySet<string>
  toggleSelected: (identifier: string) => void
  /** Number of currently-selected active TWAPs (bulk Cancel(N) label). */
  selectedCount: number
  /** Cancel one active TWAP (per-row Cancel). */
  cancelTwap: (twap: ActiveTwap) => void
  /** Request the bulk Cancel(N) confirm for the current selection. */
  requestBulkCancel: () => void
  /** Whether the bulk Cancel(N) confirm is open. */
  isBulkConfirmOpen: boolean
  /** Run the confirmed bulk cancel (fan-out over selection) and close the confirm. */
  confirmBulkCancel: () => void
  /** Dismiss the bulk confirm without cancelling. */
  dismissBulkCancel: () => void
  /** History sub-tab (completed TWAPs). */
  hasTwapHistory: boolean
  twapHistory: ReadonlyArray<TwapHistoryEntry>
  historyPagination: UsePaginatedHistoryReturn<TwapHistoryEntry>
  historyCount: number
  isHistoryLoading: boolean
  historyError: string | null
  /** Fill History sub-tab (per-slice TWAP fills). */
  hasFillHistory: boolean
  fillHistory: ReadonlyArray<Fill>
  fillHistoryPagination: UsePaginatedHistoryReturn<Fill>
  fillHistoryCount: number
  isFillHistoryLoading: boolean
  fillHistoryError: string | null
  /** Mobile breakpoint — bulk confirm renders as a bottom sheet. */
  isMobile: boolean
}

export interface TwapPanelProps {
  /** Account identity — bumped on (re)connect / spectate switch to reload tabs. */
  reloadKey?: string | null
}

export interface TwapActivePanelProps {
  twaps: ReadonlyArray<ActiveTwap>
  isLoading: boolean
  now: number
  hasTwapController: boolean
  selectedIds: ReadonlySet<string>
  onToggleSelected: (identifier: string) => void
  onCancel: (twap: ActiveTwap) => void
}

export interface TwapActiveRowProps {
  twap: ActiveTwap
  now: number
  hasTwapController: boolean
  isSelected: boolean
  onToggleSelected: () => void
  onCancel: () => void
}

export interface TwapHistoryPanelProps {
  pagination: UsePaginatedHistoryReturn<TwapHistoryEntry>
  totalCount: number
  isLoading: boolean
  historyError: string | null
}

export interface TwapHistoryRowProps {
  entry: TwapHistoryEntry
}

export interface TwapFillHistoryPanelProps {
  pagination: UsePaginatedHistoryReturn<Fill>
  totalCount: number
  isLoading: boolean
  historyError: string | null
}

export interface TwapFillHistoryRowProps {
  fill: Fill
}

export interface TwapProgressBarProps {
  /** Progress in `[0, 1]` — already clamped by the caller (`twapProgressFraction`). */
  fraction: number
  /** Percent label rendered beside the bar (e.g. `25%`). */
  label: string
}

export interface TwapBulkCancelConfirmProps {
  isOpen: boolean
  isMobile: boolean
  count: number
  onConfirm: () => void
  onCancel: () => void
}
