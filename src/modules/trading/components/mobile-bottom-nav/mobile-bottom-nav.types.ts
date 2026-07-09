import type { To } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

/** A cell's glyph: either a Lucide icon (Trade / Portfolio / Place Order) or the
 * brand AI mascot (Ask AI, ADR-0050). */
export type NavIcon = { kind: 'lucide'; Icon: LucideIcon } | { kind: 'ai' }

/** A footer cell that navigates to a route (Trade, Portfolio). */
export interface NavLinkSpec {
  key: string
  label: string
  to: string
  matchPrefix: string
  icon: NavIcon
}

/** A resolved route cell — `to` is spectate-aware and `active` tracks the path. */
export interface ResolvedLinkCell {
  kind: 'link'
  key: string
  label: string
  to: To
  active: boolean
  testId: string
  icon: NavIcon
}

/** A resolved action cell — opens a sheet instead of navigating (Ask AI, Place Order). */
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
  onAskAi: () => void
  onAccount: () => void
  onSettings: () => void
}

export interface UseMobileBottomNavReturn {
  cells: readonly ResolvedNavCell[]
}

export interface MobileBottomNavProps {
  onAskAi: () => void
  onAccount: () => void
  onSettings: () => void
}
