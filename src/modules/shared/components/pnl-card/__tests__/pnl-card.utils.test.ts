import { describe, it, expect } from 'vitest'
import {
  buildShareLink,
  buildTelegramShareUrl,
  buildXIntentText,
  buildXIntentUrl,
  cardIconCandidates,
  collectibleKeyOf,
  deriveClosedFillEntry,
  exportFileName,
  fromClosedFill,
  fromPositionSnapshot,
  marketDeepLinkPath,
  reachableArtKeys,
  sideFromDirection,
  stepRing,
} from '../pnl-card.utils'
import { ART_THEMES, MASCOTS, PLANETS } from '../pnl-card.constants'
import { buildIconMarket } from '@/modules/shared/utils/resolve-market-icon-url'
import { formatTokenAmount } from '@/modules/shared/utils/format-number'
import { fakeClosedFill, fakePositionSnapshot } from '../__fixtures__/pnl-card-fixtures'

const ORIGIN = 'https://app.example.com'

describe('collectibleKeyOf', () => {
  it('joins the selection axes into the CARD_ART key', () => {
    expect(collectibleKeyOf({ planet: 'saturn', mascot: 'dino', theme: 'dark' })).toBe(
      'saturn-dino-dark',
    )
  })
})

describe('reachableArtKeys', () => {
  it('unions the planet, mascot, and theme rings for the current selection, deduped', () => {
    const selection = { planet: 'saturn', mascot: 'dino', theme: 'dark' } as const
    const keys = reachableArtKeys(selection)
    const unique = new Set(keys)
    // Deduped — the current selection sits in all three rings but appears once.
    expect(unique.size).toBe(keys.length)
    // Bounded to the neighbours of the current selection, far below all 48.
    const expectedCount = PLANETS.length + MASCOTS.length + ART_THEMES.length - 2
    expect(keys.length).toBe(expectedCount)
    expect(keys.length).toBeLessThan(PLANETS.length * MASCOTS.length * ART_THEMES.length)
  })

  it('covers every planet neighbour at the current mascot and theme', () => {
    const keys = new Set(reachableArtKeys({ planet: 'saturn', mascot: 'dino', theme: 'dark' }))
    for (const planet of PLANETS) {
      expect(keys.has(`${planet}-dino-dark`)).toBe(true)
    }
  })

  it('covers every mascot and theme neighbour but no off-axis combination', () => {
    const keys = new Set(reachableArtKeys({ planet: 'saturn', mascot: 'dino', theme: 'dark' }))
    for (const mascot of MASCOTS) {
      expect(keys.has(`saturn-${mascot}-dark`)).toBe(true)
    }
    expect(keys.has('saturn-dino-light')).toBe(true)
    // An off-axis neighbour (two axes changed at once) is never reachable in one step.
    expect(keys.has('mercury-cat-light')).toBe(false)
  })
})

describe('stepRing', () => {
  it('steps forward mid-ring', () => {
    expect(stepRing(PLANETS, 'saturn', 1)).toBe('uranus')
  })

  it('steps backward mid-ring', () => {
    expect(stepRing(PLANETS, 'saturn', -1)).toBe('jupiter')
  })

  it('wraps forward past the last element to the first', () => {
    expect(stepRing(PLANETS, 'neptune', 1)).toBe('mercury')
  })

  it('wraps backward past the first element to the last', () => {
    expect(stepRing(PLANETS, 'mercury', -1)).toBe('neptune')
  })

  it('wraps the short mascot ring in both directions', () => {
    expect(stepRing(MASCOTS, 'dino', 1)).toBe('bug')
    expect(stepRing(MASCOTS, 'bug', -1)).toBe('dino')
  })
})

describe('cardIconCandidates', () => {
  it('leads with the CORS-capable TradingView URL for a mapped crypto coin', () => {
    // BTC has a TV logoid and an HL fallback; TV must come first so the export
    // has an inlinable source.
    const candidates = cardIconCandidates(buildIconMarket('BTC', 'perp'))
    expect(candidates[0]).toContain('s3-symbol-logo.tradingview.com')
    expect(candidates.some((url) => url.includes('app.hyperliquid.xyz'))).toBe(true)
    expect(new Set(candidates).size).toBe(candidates.length)
  })

  it('returns only the HL URL (no inlinable source) for a coin with no TV logoid', () => {
    const candidates = cardIconCandidates(buildIconMarket('ZZZNOTREAL', 'perp'))
    expect(candidates.every((url) => !url.includes('tradingview.com'))).toBe(true)
  })
})

describe('fromPositionSnapshot', () => {
  it('projects a long position into a full card view', () => {
    const view = fromPositionSnapshot(fakePositionSnapshot())
    expect(view.side).toBe('long')
    expect(view.mode).toBe('full')
    expect(view.leverageLabel).toBe('20x')
    expect(view.heroPctLabel).toBe('+31.63%')
    expect(view.heroUsdLabel).toBe('+$3,835.00')
    expect(view.heroSign).toBe('positive')
    expect(view.markRowLabel).toBe('Mark')
    expect(view.realizedBadge).toBeNull()
    expect(view.deepLinkPath).toBe('/trade?market=hl:BTC-PERP')
  })

  it('flags a realized (post-close) card and a negative hero sign', () => {
    const view = fromPositionSnapshot(
      fakePositionSnapshot({ side: 'short', unrealizedPnlUsd: -120, roePct: -8.4, leverage: 5 }),
      { realized: true },
    )
    expect(view.side).toBe('short')
    expect(view.leverageLabel).toBe('5x')
    expect(view.heroSign).toBe('negative')
    expect(view.heroPctLabel).toBe('-8.40%')
    expect(view.realizedBadge).toBe('Realized')
  })

  it('cleans a HIP-3 symbol for display but keeps the raw symbol for the link', () => {
    const view = fromPositionSnapshot(fakePositionSnapshot({ symbol: 'xyz:NVDA' }))
    expect(view.displaySymbol).toBe('NVDA')
    expect(view.symbol).toBe('xyz:NVDA')
    expect(view.deepLinkPath).toBe('/trade?market=hl:xyz:NVDA')
  })

  it('stamps the handle and DEX label/icon from the context', () => {
    const view = fromPositionSnapshot(fakePositionSnapshot(), {
      handle: 'satoshi',
      venueId: 'hyperliquid',
      venueLabel: 'Hyperliquid',
    })
    expect(view.handle).toBe('satoshi')
    expect(view.venueLabel).toBe('Hyperliquid')
    expect(view.venueIconSrc).not.toBeNull()
  })

  it('defaults context fields when none is supplied (bare call)', () => {
    const view = fromPositionSnapshot(fakePositionSnapshot())
    expect(view.handle).toBeNull()
    expect(view.venueLabel).toBe('')
    expect(view.venueIconSrc).toBeNull()
    expect(view.market).toBeNull()
  })
})

describe('fromClosedFill', () => {
  it('derives the entry row and realized % from the fill arithmetic (long)', () => {
    const view = fromClosedFill(fakeClosedFill())
    expect(view.mode).toBe('degraded')
    expect(view.side).toBe('long')
    expect(view.leverageLabel).toBeNull()
    // entry = 3120.5 − 412.8/2 = 2914.1; pct = 412.8 / (2914.1 × 2) ≈ +7.08%
    expect(view.entryPriceLabel).toBe(formatTokenAmount(2914.1))
    expect(view.heroPctLabel).toBe('+7.08%')
    expect(view.heroUsdLabel).toBe('+$412.80')
    expect(view.markRowLabel).toBe('Exit')
    expect(view.realizedBadge).toBe('Realized')
  })

  it('derives the short entry on the other side of the exit', () => {
    const view = fromClosedFill(
      fakeClosedFill({ direction: 'Close Short', side: 'buy', closedPnl: -100 }),
    )
    // entry = 3120.5 + (−100/2) = 3070.5; pct = −100 / (3070.5 × 2) ≈ −1.63%
    expect(view.side).toBe('short')
    expect(view.entryPriceLabel).toBe(formatTokenAmount(3070.5))
    expect(view.heroPctLabel).toBe('-1.63%')
    expect(view.heroSign).toBe('negative')
  })

  it('treats a missing closedPnl as a flat zero hero with no entry or %', () => {
    const view = fromClosedFill(fakeClosedFill({ closedPnl: undefined }))
    expect(view.heroUsdLabel).toBe('+$0.00')
    expect(view.heroSign).toBe('neutral')
    expect(view.heroPctLabel).toBeNull()
    expect(view.entryPriceLabel).toBeNull()
  })
})

describe('deriveClosedFillEntry', () => {
  it('returns null when the arithmetic degenerates', () => {
    expect(deriveClosedFillEntry('long', 3120.5, 0, 100)).toBeNull()
    // a long profit larger than the exit notional would imply entry ≤ 0
    expect(deriveClosedFillEntry('long', 100, 1, 150)).toBeNull()
    expect(deriveClosedFillEntry('long', 3120.5, 2, undefined)).toBeNull()
  })
})

describe('sideFromDirection', () => {
  it('reads the venue direction label first', () => {
    expect(sideFromDirection('Close Short', 'buy')).toBe('short')
    expect(sideFromDirection('Close Long', 'sell')).toBe('long')
  })

  it('falls back to close mechanics when the label is absent', () => {
    expect(sideFromDirection(undefined, 'sell')).toBe('long')
    expect(sideFromDirection(undefined, 'buy')).toBe('short')
  })
})

describe('share builders', () => {
  it('builds an absolute market link', () => {
    const view = fromPositionSnapshot(fakePositionSnapshot())
    expect(buildShareLink(view, ORIGIN)).toBe('https://app.example.com/trade?market=hl:BTC-PERP')
  })

  it('builds tweet text with hero, side, symbol, and brand', () => {
    const view = fromPositionSnapshot(fakePositionSnapshot())
    expect(buildXIntentText(view)).toBe('+31.63% LONG BTC-PERP on INVADER')
  })

  it('falls back to the $ figure in tweet text when no % is derivable', () => {
    const view = fromClosedFill(fakeClosedFill({ closedPnl: undefined }))
    expect(buildXIntentText(view)).toBe('+$0.00 LONG ETH-PERP on INVADER')
  })

  it('url-encodes the intent text and link', () => {
    const view = fromPositionSnapshot(fakePositionSnapshot())
    const url = buildXIntentUrl(view, ORIGIN)
    expect(url.startsWith('https://twitter.com/intent/tweet?text=')).toBe(true)
    expect(url).toContain(encodeURIComponent('+31.63% LONG BTC-PERP on INVADER'))
    expect(url).toContain(encodeURIComponent('https://app.example.com/trade?market=hl:BTC-PERP'))
  })

  it('sanitizes the export filename', () => {
    expect(exportFileName(fromPositionSnapshot(fakePositionSnapshot({ symbol: 'xyz:NVDA' })))).toBe(
      'pnl-xyz-NVDA.png',
    )
  })

  it('builds the deep-link path', () => {
    expect(marketDeepLinkPath('SOL-PERP')).toBe('/trade?market=hl:SOL-PERP')
  })

  it('builds a Telegram share URL with the link and text', () => {
    const view = fromPositionSnapshot(fakePositionSnapshot())
    const url = buildTelegramShareUrl(view, ORIGIN)
    expect(url.startsWith('https://t.me/share/url?url=')).toBe(true)
    expect(url).toContain(encodeURIComponent('https://app.example.com/trade?market=hl:BTC-PERP'))
    expect(url).toContain(encodeURIComponent('+31.63% LONG BTC-PERP on INVADER'))
  })
})
