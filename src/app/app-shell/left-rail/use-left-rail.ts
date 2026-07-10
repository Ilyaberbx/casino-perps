import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { RAIL_GROUPS } from './left-rail.constants'
import type {
  RailItem,
  ResolvedRailGroup,
  ResolvedRailItem,
  UseLeftRailReturn,
} from './left-rail.types'

const LOBBY_PATH = '/'
const VIEW_PARAM = 'view'
const DEFAULT_LOBBY_VIEW = 'all'

function isItemActive(item: RailItem, pathname: string, currentView: string): boolean {
  if (item.kind === 'mailto') return false

  if (item.kind === 'route') {
    return pathname === item.to || pathname.startsWith(`${item.to}/`)
  }

  const isOnLobby = pathname === LOBBY_PATH
  const isMatchingView = item.view === currentView
  return isOnLobby && isMatchingView
}

/** Resolves the static rail model against the current location so the active
 * item highlights. Lobby items match on the `?view=` param; route items match on
 * the path. All state is derived — the rail is a dumb component. */
export function useLeftRail(): UseLeftRailReturn {
  const { pathname, search } = useLocation()

  const groups = useMemo<readonly ResolvedRailGroup[]>(() => {
    const currentView = new URLSearchParams(search).get(VIEW_PARAM) ?? DEFAULT_LOBBY_VIEW
    return RAIL_GROUPS.map((group) => {
      const items: ResolvedRailItem[] = group.items.map((item) => ({
        item,
        active: isItemActive(item, pathname, currentView),
      }))
      return { key: group.key, label: group.label, items }
    })
  }, [pathname, search])

  return { groups }
}
