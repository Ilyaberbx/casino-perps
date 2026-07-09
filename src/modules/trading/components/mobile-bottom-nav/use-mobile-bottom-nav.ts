import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { Settings, User } from 'lucide-react'
import { useSpectateLink } from '@/modules/spectate'
import { LINK_CELLS } from './mobile-bottom-nav.constants'
import type {
  ResolvedNavCell,
  UseMobileBottomNavParams,
  UseMobileBottomNavReturn,
} from './mobile-bottom-nav.types'

export function useMobileBottomNav({
  onAskAi,
  onAccount,
  onSettings,
}: UseMobileBottomNavParams): UseMobileBottomNavReturn {
  const { pathname } = useLocation()
  const buildSpectateLink = useSpectateLink()

  const cells = useMemo<readonly ResolvedNavCell[]>(() => {
    const linkCells: ResolvedNavCell[] = LINK_CELLS.map((cell) => {
      const active = pathname.startsWith(cell.matchPrefix)
      return {
        kind: 'link',
        key: cell.key,
        label: cell.label,
        to: buildSpectateLink(cell.to),
        active,
        testId: `mobile-nav-cell-${cell.key}`,
        icon: cell.icon,
      }
    })

    const actionCells: ResolvedNavCell[] = [
      {
        kind: 'action',
        key: 'ask-ai',
        label: 'Ask AI',
        onClick: onAskAi,
        testId: 'mobile-nav-cell-ask-ai',
        icon: { kind: 'ai' },
      },
      {
        kind: 'action',
        key: 'account',
        label: 'Account',
        onClick: onAccount,
        testId: 'mobile-nav-cell-account',
        icon: { kind: 'lucide', Icon: User },
      },
      {
        kind: 'action',
        key: 'settings',
        label: 'Settings',
        onClick: onSettings,
        testId: 'mobile-nav-cell-settings',
        icon: { kind: 'lucide', Icon: Settings },
      },
    ]

    return [...linkCells, ...actionCells]
  }, [pathname, buildSpectateLink, onAskAi, onAccount, onSettings])

  return { cells }
}
