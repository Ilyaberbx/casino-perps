import type { To } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

/** A cell's glyph — a Lucide line icon painting in `currentColor`. */
export type NavIcon = { kind: 'lucide'; Icon: LucideIcon }

/** A static route cell (Browse, My Bets). */
export interface NavLinkSpec {
  key: string
  label: string
  to: string
  /** `exact` matches the whole path (Browse = `/`); `prefix` matches a subtree. */
  match: 'exact' | 'prefix'
  icon: NavIcon
}

/** A route cell resolved against the current path. */
export interface ResolvedLinkCell {
  kind: 'link'
  key: string
  label: string
  to: To
  active: boolean
  testId: string
  icon: NavIcon
}

/** An action cell that opens an overlay instead of navigating (Markets, Chat). */
export interface ResolvedActionCell {
  kind: 'action'
  key: string
  label: string
  onClick: () => void
  testId: string
  icon: NavIcon
}

export type ResolvedNavCell = ResolvedLinkCell | ResolvedActionCell

export interface UseMobileBottomNavParams {
  onOpenSearch: () => void
  onOpenChat: () => void
}

export interface UseMobileBottomNavReturn {
  cells: readonly ResolvedNavCell[]
}

export interface MobileBottomNavProps {
  /** Opens the market-search overlay (the "Markets" tab). */
  onOpenSearch: () => void
  /** Opens the mobile chat sheet (the "Chat" tab). */
  onOpenChat: () => void
}
