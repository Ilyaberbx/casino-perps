import { Compass, Ticket } from 'lucide-react'
import type { NavLinkSpec } from './mobile-bottom-nav.types'

/** The two route cells (Browse → lobby, My Bets). The Markets and Chat cells are
 * actions (they open overlays), appended in the hook since they carry runtime
 * handlers, not routes. Order in the bar: Browse, Markets, My Bets, Chat
 * (PRD 0008 §6). */
export const BROWSE_CELL: NavLinkSpec = {
  key: 'browse',
  label: 'Browse',
  to: '/',
  match: 'exact',
  icon: { kind: 'lucide', Icon: Compass },
}

export const MY_BETS_CELL: NavLinkSpec = {
  key: 'my-bets',
  label: 'My Bets',
  to: '/my-bets',
  match: 'prefix',
  icon: { kind: 'lucide', Icon: Ticket },
}
