import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { useLeftRail } from '../use-left-rail'
import { railItemTo } from '../left-rail.utils'
import type { RailLobbyItem, RailRouteItem } from '../left-rail.types'

function activeKeys(route: string): string[] {
  const { result } = renderHook(() => useLeftRail(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(MemoryRouter, { initialEntries: [route] }, children),
  })
  return result.current.groups
    .flatMap((group) => group.items)
    .filter((resolved) => resolved.active)
    .map((resolved) => resolved.item.key)
}

describe('useLeftRail active item', () => {
  it('highlights All Markets on the bare lobby', () => {
    expect(activeKeys('/')).toEqual(['all'])
  })

  it.each(['hot', 'new', 'favorites', 'recent', 'all'])('highlights %s for its own view', (view) => {
    expect(activeKeys(`/?view=${view}`)).toEqual([view])
  })

  // The latent bug the shared parser fixes: an unknown view used to highlight
  // nothing, while the page rendered the full lobby. Now they agree.
  it('falls back to All Markets for an unrecognised view', () => {
    expect(activeKeys('/?view=bogus')).toEqual(['all'])
  })

  it('highlights the route item on its own path', () => {
    expect(activeKeys('/my-bets')).toEqual(['my-bets'])
  })

  it('highlights nothing on a lobby-unrelated route', () => {
    expect(activeKeys('/trade/BTC')).toEqual([])
  })
})

describe('railItemTo', () => {
  const lobbyItem = (view: RailLobbyItem['view']): RailLobbyItem =>
    ({ kind: 'lobby', key: view, label: view, view }) as RailLobbyItem

  it('sends the `all` view to the bare lobby, with no query', () => {
    expect(railItemTo(lobbyItem('all'))).toEqual({ pathname: '/' })
  })

  it.each(['hot', 'new', 'favorites', 'recent'] as const)('carries `?view=%s`', (view) => {
    expect(railItemTo(lobbyItem(view))).toEqual({ pathname: '/', search: `?view=${view}` })
  })

  it('sends a route item to its path', () => {
    const item = { kind: 'route', key: 'my-bets', label: 'My Bets', to: '/my-bets' } as RailRouteItem
    expect(railItemTo(item)).toBe('/my-bets')
  })
})
