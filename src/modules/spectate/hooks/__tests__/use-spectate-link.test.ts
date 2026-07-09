import { renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { SpectateProvider } from '../../providers/spectate-provider'
import { useSpectateLink } from '../use-spectate-link'

const ADDRESS = '0x1111111111111111111111111111111111111111'

function wrapper(initialEntries: string[]) {
  return ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, { initialEntries }, createElement(SpectateProvider, null, children))
}

describe('useSpectateLink', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns the bare pathname when not spectating', () => {
    const { result } = renderHook(() => useSpectateLink(), { wrapper: wrapper(['/trade']) })
    expect(result.current('/portfolio')).toBe('/portfolio')
  })

  it('carries the active spectate param onto the target pathname', () => {
    const { result } = renderHook(() => useSpectateLink(), {
      wrapper: wrapper([`/trade?spectate=${ADDRESS}`]),
    })
    expect(result.current('/portfolio')).toEqual({
      pathname: '/portfolio',
      search: `spectate=${ADDRESS}`,
    })
  })

  it('drops a malformed spectate param (reads as not spectating)', () => {
    const { result } = renderHook(() => useSpectateLink(), {
      wrapper: wrapper(['/trade?spectate=not-an-address']),
    })
    expect(result.current('/portfolio')).toBe('/portfolio')
  })

  it('does not leak other params (e.g. market) onto the target', () => {
    const { result } = renderHook(() => useSpectateLink(), {
      wrapper: wrapper([`/trade?market=BTC&spectate=${ADDRESS}`]),
    })
    expect(result.current('/portfolio')).toEqual({
      pathname: '/portfolio',
      search: `spectate=${ADDRESS}`,
    })
  })
})
