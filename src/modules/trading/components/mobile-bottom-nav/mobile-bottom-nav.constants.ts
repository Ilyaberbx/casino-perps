import { ChartCandlestick, Wallet } from 'lucide-react'
import type { NavLinkSpec } from './mobile-bottom-nav.types'

/** The two real routes the footer exposes; action cells (Ask AI, Place Order) are
 * appended in the hook since they carry runtime handlers, not static routes. */
export const LINK_CELLS: readonly NavLinkSpec[] = [
  {
    key: 'trade',
    label: 'Trade',
    to: '/trade',
    matchPrefix: '/trade',
    icon: { kind: 'lucide', Icon: ChartCandlestick },
  },
  {
    key: 'portfolio',
    label: 'Portfolio',
    to: '/portfolio',
    matchPrefix: '/portfolio',
    icon: { kind: 'lucide', Icon: Wallet },
  },
] as const
