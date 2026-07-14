import type { To } from 'react-router-dom'
import { DEFAULT_LOBBY_VIEW, LOBBY_VIEW_PARAM } from '@/modules/lobby'
import type { RailLobbyItem, RailRouteItem } from './left-rail.types'

/** The router target for a navigating rail item. Lobby items land on `/`; a
 * non-`all` view is carried as `?view=`, which the lobby reads to render its
 * focused grid. `all` is the bare lobby, so it needs no query. */
export function railItemTo(item: RailLobbyItem | RailRouteItem): To {
  if (item.kind === 'route') return item.to
  if (item.view === DEFAULT_LOBBY_VIEW) return { pathname: '/' }
  return { pathname: '/', search: `?${LOBBY_VIEW_PARAM}=${item.view}` }
}
