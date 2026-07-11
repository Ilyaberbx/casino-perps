import type { LucideIcon } from 'lucide-react'

/** A rail item that returns to the lobby, optionally pre-selecting a view. The
 * lobby phase reads `?view=` to filter; today every lobby item lands on `/`. */
export interface RailLobbyItem {
  kind: 'lobby'
  key: string
  label: string
  icon: LucideIcon
  /** Lobby view key. `all` is the bare lobby (no query). */
  view: 'favorites' | 'recent' | 'hot' | 'new' | 'all'
}

/** A rail item that navigates to a first-class route (My Bets). */
export interface RailRouteItem {
  kind: 'route'
  key: string
  label: string
  icon: LucideIcon
  to: string
}

/** A rail item that opens an external `mailto:` (Live Support). */
export interface RailMailtoItem {
  kind: 'mailto'
  key: string
  label: string
  icon: LucideIcon
  href: string
}

export type RailItem = RailLobbyItem | RailRouteItem | RailMailtoItem

/** A labelled (or unlabelled) group of rail items. */
export interface RailGroup {
  key: string
  /** Section label (`MARKETS`, `GENERAL`). Absent groups render no header. */
  label?: string
  items: readonly RailItem[]
}

/** A rail item resolved against the current location for rendering. */
export interface ResolvedRailItem {
  item: RailItem
  active: boolean
}

export interface ResolvedRailGroup {
  key: string
  label?: string
  items: readonly ResolvedRailItem[]
}

export interface LeftRailProps {
  /** Icon-only 76px rendering — labels, segments, and the wordmark hide. */
  collapsed: boolean
  /** Opens the Add Cash (deposit) flow. */
  onAddCash: () => void
  /** Toggles the shell's collapsed rail state. */
  onCollapse: () => void
}

export interface UseLeftRailReturn {
  groups: readonly ResolvedRailGroup[]
}
