import { describe, it, expect } from 'vitest'
import { parseHip3Symbol } from '../hip3-symbol'

describe('parseHip3Symbol()', () => {
  it('splits a HIP-3 symbol into an uppercased dex tag and asset display symbol', () => {
    expect(parseHip3Symbol('xyz:NVDA')).toEqual({
      isHip3: true,
      dexTag: 'XYZ',
      displaySymbol: 'NVDA',
    })
  })

  it('treats a bare symbol as non-HIP-3 and passes it through as the display symbol', () => {
    expect(parseHip3Symbol('BTC')).toEqual({
      isHip3: false,
      dexTag: '',
      displaySymbol: 'BTC',
    })
  })

  it('falls back to the raw symbol when the asset segment is missing', () => {
    expect(parseHip3Symbol('foo:')).toEqual({
      isHip3: true,
      dexTag: 'FOO',
      displaySymbol: 'foo:',
    })
  })
})
