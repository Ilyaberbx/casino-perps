import { Star, History, Flame, Sparkles, LayoutGrid, Ticket, Trophy, Headset } from 'lucide-react'
import type { RailGroup } from './left-rail.types'

/** Where "Live Support" points. A plain `mailto:` per PRD 0008 §6 — no ticketing
 * backend exists. Overridable later; not env-derived because it is a fixed brand
 * inbox, not a per-environment value. */
export const SUPPORT_MAILTO = 'mailto:support@yeet.bet'

/** The rail's segmented control. "Perps" is the only live segment; "Soon" is a
 * disabled decoration standing in for yeet's "Sports" (PRD 0008 §6, D8). */
export const RAIL_SEGMENTS = [
  { value: 'perps', label: 'Perps', disabled: false },
  { value: 'soon', label: 'Soon', disabled: true },
] as const

export type RailSegmentValue = (typeof RAIL_SEGMENTS)[number]['value']

/** Rail nav groups, top to bottom, mirroring yeet's structure with our content
 * (PRD 0008 §6). The first group is unlabelled; MARKETS and GENERAL carry
 * muted section labels. */
export const RAIL_GROUPS: readonly RailGroup[] = [
  {
    key: 'quick',
    items: [
      { kind: 'lobby', key: 'favorites', label: 'Favorites', icon: Star, view: 'favorites' },
      { kind: 'lobby', key: 'recent', label: 'Recent', icon: History, view: 'recent' },
    ],
  },
  {
    key: 'markets',
    label: 'MARKETS',
    items: [
      { kind: 'lobby', key: 'hot', label: 'Hot', icon: Flame, view: 'hot' },
      { kind: 'lobby', key: 'new', label: 'New', icon: Sparkles, view: 'new' },
      { kind: 'lobby', key: 'all', label: 'All Markets', icon: LayoutGrid, view: 'all' },
    ],
  },
  {
    key: 'general',
    label: 'GENERAL',
    items: [
      { kind: 'route', key: 'my-bets', label: 'My Bets', icon: Ticket, to: '/my-bets' },
      { kind: 'route', key: 'leaderboard', label: 'Leaderboard', icon: Trophy, to: '/leaderboard' },
      { kind: 'mailto', key: 'support', label: 'Live Support', icon: Headset, href: SUPPORT_MAILTO },
    ],
  },
] as const
