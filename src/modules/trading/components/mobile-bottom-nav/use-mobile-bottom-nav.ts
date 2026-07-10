import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { Search, MessageCircle } from 'lucide-react'
import { BROWSE_CELL, MY_BETS_CELL } from './mobile-bottom-nav.constants'
import type {
  NavLinkSpec,
  ResolvedActionCell,
  ResolvedLinkCell,
  ResolvedNavCell,
  UseMobileBottomNavParams,
  UseMobileBottomNavReturn,
} from './mobile-bottom-nav.types'

function isLinkActive(spec: NavLinkSpec, pathname: string): boolean {
  if (spec.match === 'exact') return pathname === spec.to
  return pathname === spec.to || pathname.startsWith(`${spec.to}/`)
}

function toLinkCell(spec: NavLinkSpec, pathname: string): ResolvedLinkCell {
  return {
    kind: 'link',
    key: spec.key,
    label: spec.label,
    to: spec.to,
    active: isLinkActive(spec, pathname),
    testId: `mobile-nav-cell-${spec.key}`,
    icon: spec.icon,
  }
}

/**
 * Resolves the four casino tabs against the current path. Browse and My Bets are
 * routes; Markets and Chat open overlays via the injected handlers. The bar
 * order (Browse, Markets, My Bets, Chat) is assembled here (PRD 0008 §6).
 */
export function useMobileBottomNav({
  onOpenSearch,
  onOpenChat,
}: UseMobileBottomNavParams): UseMobileBottomNavReturn {
  const { pathname } = useLocation()

  const cells = useMemo<readonly ResolvedNavCell[]>(() => {
    const browse = toLinkCell(BROWSE_CELL, pathname)
    const myBets = toLinkCell(MY_BETS_CELL, pathname)

    const markets: ResolvedActionCell = {
      kind: 'action',
      key: 'markets',
      label: 'Markets',
      onClick: onOpenSearch,
      testId: 'mobile-nav-cell-markets',
      icon: { kind: 'lucide', Icon: Search },
    }

    const chat: ResolvedActionCell = {
      kind: 'action',
      key: 'chat',
      label: 'Chat',
      onClick: onOpenChat,
      testId: 'mobile-nav-cell-chat',
      icon: { kind: 'lucide', Icon: MessageCircle },
    }

    return [browse, markets, myBets, chat]
  }, [pathname, onOpenSearch, onOpenChat])

  return { cells }
}
