import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { parseLobbyView } from '@/modules/lobby'
import type { LobbyView } from '@/modules/lobby'
import { RAIL_GROUPS } from './left-rail.constants'
import type {
  RailItem,
  ResolvedRailGroup,
  ResolvedRailItem,
  UseLeftRailReturn,
} from './left-rail.types'

const LOBBY_PATH = '/'

function isItemActive(item: RailItem, pathname: string, currentView: LobbyView): boolean {
  // Neither leaves the current location: mailto hands off to a mail client, and
  // an action opens a modal. There is nothing for them to match against.
  if (item.kind === 'mailto' || item.kind === 'action') return false

  if (item.kind === 'route') {
    return pathname === item.to || pathname.startsWith(`${item.to}/`)
  }

  const isOnLobby = pathname === LOBBY_PATH
  const isMatchingView = item.view === currentView
  return isOnLobby && isMatchingView
}

/** Resolves the static rail model against the current location so the active
 * item highlights. Lobby items match on the `?view=` param; route items match on
 * the path. All state is derived — the rail is a dumb component.
 *
 * The view comes from the lobby's own `parseLobbyView`, so the rail and the page
 * can never disagree. That also means an unrecognised `?view=bogus` highlights
 * "All Markets" — which is what the page renders — instead of highlighting
 * nothing, as the old hand-rolled read did. */
export function useLeftRail(): UseLeftRailReturn {
  const { pathname, search } = useLocation()

  const groups = useMemo<readonly ResolvedRailGroup[]>(() => {
    const currentView = parseLobbyView(search)
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
