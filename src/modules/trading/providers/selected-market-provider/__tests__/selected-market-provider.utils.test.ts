import { describe, it, expect } from 'vitest'
import {
  parseMarketParam,
  formatMarketParam,
  isMarketSymbol,
  buildTradeMarketHref,
} from '../selected-market-provider.utils'

describe('parseMarketParam', () => {
  it('parses a well-formed hl:<symbol> param', () => {
    expect(parseMarketParam('hl:BTC-PERP')).toEqual({ venue: 'hl', coin: 'BTC-PERP' })
  })

  it.each([
    ['empty string', ''],
    ['missing prefix', 'BTC-PERP'],
    ['wrong venue prefix', 'cex:BTC-PERP'],
    ['empty coin', 'hl:'],
    ['only colon', ':'],
  ])('returns null for %s', (_label, input) => {
    expect(parseMarketParam(input)).toBeNull()
  })
})

describe('formatMarketParam', () => {
  it('formats a market symbol as hl:<symbol>', () => {
    expect(formatMarketParam('BTC-PERP')).toBe('hl:BTC-PERP')
  })

  it.each(['BTC-PERP', 'ETH-PERP', 'SOL-PERP', 'DOGE-PERP'])(
    'round-trips with parseMarketParam for %s',
    (symbol) => {
      const formatted = formatMarketParam(symbol)
      const parsed = parseMarketParam(formatted)
      expect(parsed).toEqual({ venue: 'hl', coin: symbol })
    },
  )
})

describe('buildTradeMarketHref', () => {
  it('builds a /trade href with the encoded market param', () => {
    expect(buildTradeMarketHref('BTC-PERP')).toBe('/trade?market=hl%3ABTC-PERP')
  })

  it('percent-encodes the slash in a spot symbol so it survives the query string', () => {
    const href = buildTradeMarketHref('HYPE/USDC')
    const search = new URLSearchParams(href.split('?')[1])
    expect(search.get('market')).toBe('hl:HYPE/USDC')
  })
})

describe('isMarketSymbol', () => {
  it.each(['BTC-PERP', 'ETH-PERP', 'SOL-PERP', 'DOGE-PERP', 'HYPE-PERP'])(
    'accepts %s',
    (symbol) => {
      expect(isMarketSymbol(symbol)).toBe(true)
    },
  )

  it.each([
    ['missing suffix', 'BTC'],
    ['empty string', ''],
    ['wrong suffix', 'BTC-FOO'],
    ['lowercase coin', 'btc-PERP'],
    ['null', null],
    ['number', 123],
  ])('rejects %s', (_label, value) => {
    expect(isMarketSymbol(value)).toBe(false)
  })
})

describe('Spot and HIP-3 symbols (ADR-0016)', () => {
  // Post-ADR-0016 grammar:
  //   - Spot is exchange-native BASE/QUOTE (the old `<BASE>-SPOT` is invalid).
  //   - HIP-3 dex prefix is case-insensitive (real HL builder dex names are
  //     not always lowercase, e.g. `XYZ:XYZ100`); asset part is alphanumeric.

  it.each(['HYPE/USDC', 'PURR/USDC', 'BTC/USDC'])(
    'isMarketSymbol accepts Spot %s',
    (symbol) => {
      expect(isMarketSymbol(symbol)).toBe(true)
    },
  )

  it.each(['xyz:AAPL', 'flx:GOOG', 'XYZ:XYZ100'])(
    'isMarketSymbol accepts HIP-3 %s',
    (symbol) => {
      expect(isMarketSymbol(symbol)).toBe(true)
    },
  )

  it.each([
    ['old -SPOT suffix retired', 'HYPE-SPOT'],
    ['lowercase spot pair', 'hype/usdc'],
    ['spot missing quote', 'HYPE/'],
    ['spot missing base', '/USDC'],
    ['bare coin, no suffix', 'HYPE'],
    ['empty dex prefix', ':AAPL'],
    ['empty asset', 'xyz:'],
  ])('isMarketSymbol rejects %s', (_label, value) => {
    expect(isMarketSymbol(value)).toBe(false)
  })

  it('parseMarketParam round-trips hl:HYPE/USDC', () => {
    expect(parseMarketParam('hl:HYPE/USDC')).toEqual({ venue: 'hl', coin: 'HYPE/USDC' })
  })

  it('parseMarketParam round-trips hl:xyz:AAPL (double colon)', () => {
    expect(parseMarketParam('hl:xyz:AAPL')).toEqual({ venue: 'hl', coin: 'xyz:AAPL' })
  })

  it('parseMarketParam returns null for hl:HYPE (bare coin, no fallback)', () => {
    expect(parseMarketParam('hl:HYPE')).toBeNull()
  })

  it('formatMarketParam round-trips Spot and HIP-3 symbols', () => {
    expect(parseMarketParam(formatMarketParam('HYPE/USDC'))).toEqual({
      venue: 'hl',
      coin: 'HYPE/USDC',
    })
    expect(parseMarketParam(formatMarketParam('xyz:AAPL'))).toEqual({
      venue: 'hl',
      coin: 'xyz:AAPL',
    })
  })
})
