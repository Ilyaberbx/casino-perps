import { describe, it, expect } from 'vitest'
import type { Market } from '@/modules/shared/domain'
import type { SpotMetaAndAssetCtxsResponse } from '../gateway/sdk-types'
import {
  brandSdkAddress,
  buildSpotPriceIndex,
  canonicalizeUnitToken,
  formatTenthsOfBpsAsPercentString,
  isSegregatedAccount,
  mapToPeriod,
  parseStringifiedNumber,
  toDomainPerpSymbol,
  toHlCoin,
  toHlCoinFromMarket,
} from '../hyperliquid.utils'

function makeMarket(overrides: Partial<Market>): Market {
  return {
    symbol: 'BTC-PERP',
    baseAsset: 'BTC',
    quoteAsset: 'USD',
    venue: 'hyperliquid',
    tickSize: 0.1,
    stepSize: 0.001,
    ...overrides,
  }
}

describe('toDomainPerpSymbol', () => {
  it('suffixes an HL coin with -PERP', () => {
    expect(toDomainPerpSymbol('BTC')).toBe('BTC-PERP')
    expect(toDomainPerpSymbol('HYPE')).toBe('HYPE-PERP')
  })
})

describe('toHlCoin', () => {
  it('strips -PERP from a domain symbol', () => {
    expect(toHlCoin('BTC-PERP')).toBe('BTC')
    expect(toHlCoin('SOL-PERP')).toBe('SOL')
  })

  it('is a no-op for an already-bare HL coin', () => {
    expect(toHlCoin('BTC')).toBe('BTC')
  })
})

describe('toHlCoinFromMarket (MKT-05 / ADR-0013 single-resolution-point)', () => {
  it('perp market with hlCoin "BTC" returns "BTC"', () => {
    const market = makeMarket({ symbol: 'BTC-PERP', marketType: 'perp', hlCoin: 'BTC' })
    expect(toHlCoinFromMarket(market)).toBe('BTC')
  })

  it('spot market with hlCoin "@107" returns "@107"', () => {
    const market = makeMarket({ symbol: 'HYPE-SPOT', marketType: 'spot', hlCoin: '@107' })
    expect(toHlCoinFromMarket(market)).toBe('@107')
  })

  it('hip3 market with hlCoin "xyz:AAPL" returns "xyz:AAPL"', () => {
    const market = makeMarket({ symbol: 'xyz:AAPL', marketType: 'hip3', hlCoin: 'xyz:AAPL' })
    expect(toHlCoinFromMarket(market)).toBe('xyz:AAPL')
  })

  it('legacy market without hlCoin falls back to toHlCoin(symbol) → "BTC"', () => {
    const market = makeMarket({ symbol: 'BTC-PERP' })
    expect(toHlCoinFromMarket(market)).toBe('BTC')
  })
})

describe('mapToPeriod', () => {
  describe('volume → null (unsupported)', () => {
    it('volume 24H all → null', () => {
      expect(mapToPeriod('volume', '24H', 'all')).toBeNull()
    })
    it('volume 7D perps → null', () => {
      expect(mapToPeriod('volume', '7D', 'perps')).toBeNull()
    })
    it('volume AllTime all → null', () => {
      expect(mapToPeriod('volume', 'AllTime', 'all')).toBeNull()
    })
  })

  describe('accountValue, all scope', () => {
    it('accountValue 24H all → day', () => {
      expect(mapToPeriod('accountValue', '24H', 'all')).toBe('day')
    })
    it('accountValue 7D all → week', () => {
      expect(mapToPeriod('accountValue', '7D', 'all')).toBe('week')
    })
    it('accountValue 30D all → month', () => {
      expect(mapToPeriod('accountValue', '30D', 'all')).toBe('month')
    })
    it('accountValue AllTime all → allTime', () => {
      expect(mapToPeriod('accountValue', 'AllTime', 'all')).toBe('allTime')
    })
  })

  describe('accountValue, perps scope', () => {
    it('accountValue 24H perps → perpDay', () => {
      expect(mapToPeriod('accountValue', '24H', 'perps')).toBe('perpDay')
    })
    it('accountValue 7D perps → perpWeek', () => {
      expect(mapToPeriod('accountValue', '7D', 'perps')).toBe('perpWeek')
    })
    it('accountValue 30D perps → perpMonth', () => {
      expect(mapToPeriod('accountValue', '30D', 'perps')).toBe('perpMonth')
    })
    it('accountValue AllTime perps → perpAllTime', () => {
      expect(mapToPeriod('accountValue', 'AllTime', 'perps')).toBe('perpAllTime')
    })
  })

  describe('pnl, all scope', () => {
    it('pnl 24H all → day', () => {
      expect(mapToPeriod('pnl', '24H', 'all')).toBe('day')
    })
    it('pnl 7D all → week', () => {
      expect(mapToPeriod('pnl', '7D', 'all')).toBe('week')
    })
    it('pnl 30D all → month', () => {
      expect(mapToPeriod('pnl', '30D', 'all')).toBe('month')
    })
    it('pnl AllTime all → allTime', () => {
      expect(mapToPeriod('pnl', 'AllTime', 'all')).toBe('allTime')
    })
  })

  describe('pnl, perps scope', () => {
    it('pnl 24H perps → perpDay', () => {
      expect(mapToPeriod('pnl', '24H', 'perps')).toBe('perpDay')
    })
    it('pnl AllTime perps → perpAllTime', () => {
      expect(mapToPeriod('pnl', 'AllTime', 'perps')).toBe('perpAllTime')
    })
  })

  describe('perpsPnl always maps to perps periods', () => {
    it('perpsPnl 24H all → perpDay', () => {
      expect(mapToPeriod('perpsPnl', '24H', 'all')).toBe('perpDay')
    })
    it('perpsPnl 7D all → perpWeek', () => {
      expect(mapToPeriod('perpsPnl', '7D', 'all')).toBe('perpWeek')
    })
    it('perpsPnl 30D all → perpMonth', () => {
      expect(mapToPeriod('perpsPnl', '30D', 'all')).toBe('perpMonth')
    })
    it('perpsPnl AllTime all → perpAllTime', () => {
      expect(mapToPeriod('perpsPnl', 'AllTime', 'all')).toBe('perpAllTime')
    })
    it('perpsPnl 24H perps → perpDay', () => {
      expect(mapToPeriod('perpsPnl', '24H', 'perps')).toBe('perpDay')
    })
    it('perpsPnl AllTime perps → perpAllTime', () => {
      expect(mapToPeriod('perpsPnl', 'AllTime', 'perps')).toBe('perpAllTime')
    })
  })
})

describe('parseStringifiedNumber', () => {
  it('coerces a positive stringified number', () => {
    expect(parseStringifiedNumber('1234.5')).toBe(1234.5)
  })
  it('coerces a negative stringified number', () => {
    expect(parseStringifiedNumber('-0.001')).toBe(-0.001)
  })
  it('returns 0 for empty/null/undefined', () => {
    expect(parseStringifiedNumber('')).toBe(0)
    expect(parseStringifiedNumber(null)).toBe(0)
    expect(parseStringifiedNumber(undefined)).toBe(0)
  })
  it('returns 0 for non-numeric input', () => {
    expect(parseStringifiedNumber('not a number')).toBe(0)
  })
})

describe('buildSpotPriceIndex', () => {
  // Mirrors live mainnet: `assetCtxs` is indexed by each pair's `.index` (sparse,
  // longer than `universe`), NOT by array position — `universe` is a compact list
  // with delisted pairs removed. Joining by array position mis-prices nearly
  // every token (the USD=0 / garbage-price bug).
  function buildResponse(): SpotMetaAndAssetCtxsResponse {
    const meta = {
      tokens: [
        { name: 'USDC', index: 0 },
        { name: 'PURR', index: 1 },
        { name: 'UBTC', index: 197 },
      ],
      universe: [
        { name: 'PURR/USDC', tokens: [1, 0], index: 0, isCanonical: true },
        { name: '@142', tokens: [197, 0], index: 142, isCanonical: false },
        // UBTC also trades against token 360 (non-USDC); its markPx is not a USD
        // value and must not overwrite the USDC-quoted price.
        { name: '@234', tokens: [197, 360], index: 234, isCanonical: false },
      ],
    }
    // Sparse ctxs: decoys everywhere, real prices only at each pair's `.index`.
    const ctxs: Array<{ markPx: string; midPx: string | null }> = []
    for (let i = 0; i < 235; i += 1) ctxs[i] = { markPx: '0.000001', midPx: null }
    ctxs[0] = { markPx: '0.098', midPx: '0.098' } // PURR/USDC at .index 0
    ctxs[142] = { markPx: '63511', midPx: '63511' } // UBTC/USDC at .index 142
    ctxs[234] = { markPx: '1.0', midPx: '1.0' } // UBTC/<token 360>, non-USDC quote
    // Wire shape requires fields irrelevant to pricing; cast at the test boundary.
    return [meta, ctxs] as unknown as SpotMetaAndAssetCtxsResponse
  }

  it('joins assetCtxs by pair.index, not array position', () => {
    const index = buildSpotPriceIndex(buildResponse())
    expect(index.get('UBTC')).toBeCloseTo(63511, 0)
    expect(index.get('PURR')).toBeCloseTo(0.098, 3)
  })

  it('pins USDC to 1', () => {
    expect(buildSpotPriceIndex(buildResponse()).get('USDC')).toBe(1)
  })

  it('ignores non-USDC-quoted pairs so they cannot overwrite the USD price', () => {
    // The UBTC/<token 360> pair (markPx 1.0) must not clobber UBTC's USDC price.
    expect(buildSpotPriceIndex(buildResponse()).get('UBTC')).toBeCloseTo(63511, 0)
  })
})

describe('canonicalizeUnitToken', () => {
  it('maps Unit-bridged tokens to their canonical symbol', () => {
    expect(canonicalizeUnitToken('UBTC')).toBe('BTC')
    expect(canonicalizeUnitToken('UETH')).toBe('ETH')
    expect(canonicalizeUnitToken('UZEC')).toBe('ZEC')
    expect(canonicalizeUnitToken('UFART')).toBe('FARTCOIN')
    expect(canonicalizeUnitToken('UUUSPX')).toBe('SPX6900')
  })
  it('leaves non-Unit U-prefixed and ordinary tokens unchanged', () => {
    expect(canonicalizeUnitToken('UNI')).toBe('UNI')
    expect(canonicalizeUnitToken('USDC')).toBe('USDC')
    expect(canonicalizeUnitToken('USDT')).toBe('USDT')
    expect(canonicalizeUnitToken('USDH')).toBe('USDH')
    expect(canonicalizeUnitToken('PURR')).toBe('PURR')
    expect(canonicalizeUnitToken('HYPE')).toBe('HYPE')
  })
})

describe('brandSdkAddress', () => {
  it('lowercases and brands a 0x address', () => {
    const branded = brandSdkAddress('0xABCDEF0123456789ABCDEF0123456789ABCDEF01')
    expect(branded).toBe('0xabcdef0123456789abcdef0123456789abcdef01')
  })
  it('throws on a malformed SDK input (unreachable invariant)', () => {
    expect(() => brandSdkAddress('0xshort' as `0x${string}`)).toThrow(/unreachable/)
  })
})

describe('formatTenthsOfBpsAsPercentString', () => {
  it('maps 10 tenths of bps to "0.01%" (1 bp)', () => {
    expect(formatTenthsOfBpsAsPercentString(10)).toBe('0.01%')
  })
  it('maps 35 tenths of bps to "0.035%" (3.5 bps, our builder fee)', () => {
    expect(formatTenthsOfBpsAsPercentString(35)).toBe('0.035%')
  })
  // Anchored to Hyperliquid's documented worked example (builder-codes docs):
  // "f: 50 means 50 tenths of a bp = 5 bps = 0.05%". External ground truth that
  // locks the divisor against regressing to 10_000 — the ADR-0024 defect that
  // produced the sub-resolution "0.0035%" Hyperliquid rejects as
  // "Percentage is invalid". See ADR-0024 Amendment (2026-05-30).
  it('maps 50 tenths of bps to "0.05%" (HL docs worked example)', () => {
    expect(formatTenthsOfBpsAsPercentString(50)).toBe('0.05%')
  })
  it('maps 100 tenths of bps to "0.1%" (10 bps, HL perps cap)', () => {
    expect(formatTenthsOfBpsAsPercentString(100)).toBe('0.1%')
  })
  it('maps 1000 tenths of bps to "1%" (100 bps, HL spot cap)', () => {
    expect(formatTenthsOfBpsAsPercentString(1000)).toBe('1%')
  })
  it('maps 0 to "0%"', () => {
    expect(formatTenthsOfBpsAsPercentString(0)).toBe('0%')
  })
})

describe('isSegregatedAccount', () => {
  it('treats classic modes as segregated', () => {
    expect(isSegregatedAccount('default')).toBe(true)
    expect(isSegregatedAccount('disabled')).toBe(true)
  })
  it('treats unified and portfolio margin as not segregated', () => {
    expect(isSegregatedAccount('unifiedAccount')).toBe(false)
    expect(isSegregatedAccount('portfolioMargin')).toBe(false)
  })
  it('treats dexAbstraction (HIP-3 axis) as segregated for the USDC spot↔perp split', () => {
    expect(isSegregatedAccount('dexAbstraction')).toBe(true)
  })
  it('defaults unknown (null) to segregated — the classic assumption', () => {
    expect(isSegregatedAccount(null)).toBe(true)
  })
})
