import type { To } from 'react-router-dom'
import type { RailLobbyItem, RailRouteItem } from './left-rail.types'

/** The router target for a navigating rail item. Lobby items land on `/`; a
 * non-`all` view is carried as `?view=` for the lobby phase to read. */
export function railItemTo(item: RailLobbyItem | RailRouteItem): To {
  if (item.kind === 'route') return item.to
  if (item.view === 'all') return { pathname: '/' }
  return { pathname: '/', search: `?view=${item.view}` }
}
