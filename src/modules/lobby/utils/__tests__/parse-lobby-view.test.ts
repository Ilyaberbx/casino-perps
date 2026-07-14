import { describe, it, expect } from 'vitest'
import { parseLobbyView } from '../parse-lobby-view'

describe('parseLobbyView', () => {
  it.each(['favorites', 'recent', 'hot', 'new', 'all'] as const)(
    'reads `?view=%s`',
    (view) => {
      expect(parseLobbyView(`?view=${view}`)).toBe(view)
    },
  )

  it('falls back to `all` for a bare lobby with no query', () => {
    expect(parseLobbyView('')).toBe('all')
  })

  it('falls back to `all` when another param is present but `view` is not', () => {
    expect(parseLobbyView('?market=BTC')).toBe('all')
  })

  // The rail used to leave an unknown view highlighting nothing. Now both the
  // rail and the page agree it means `all`.
  it('falls back to `all` for an unrecognised view', () => {
    expect(parseLobbyView('?view=bogus')).toBe('all')
  })

  it('falls back to `all` for an empty view', () => {
    expect(parseLobbyView('?view=')).toBe('all')
  })

  // The rail is the only writer and only ever writes lowercase.
  it('is case-sensitive', () => {
    expect(parseLobbyView('?view=HOT')).toBe('all')
  })

  it('reads `view` alongside other params, in any position', () => {
    expect(parseLobbyView('?market=BTC&view=recent')).toBe('recent')
  })
})
