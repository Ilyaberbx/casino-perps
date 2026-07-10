import { describe, it, expect } from 'vitest'
import {
  buildFullCloseRequest,
  directionLabel,
  formatLiquidationSentence,
  isSettlementFill,
  liquidationPriceText,
  mergeSettledBet,
  positionSideToDirection,
  projectLiveBet,
  projectSettledBet,
  tickerFromSymbol,
} from '../my-bets.utils'
import { SETTLED_BETS_LIMIT } from '../my-bets.constants'
import { makeFill, makeMarket, makePosition } from '../__fixtures__/venue'
import type { SettledBet } from '../my-bets.types'

describe('positionSideToDirection', () => {
  it('maps long to up and short to down', () => {
    expect(positionSideToDirection('long')).toBe('up')
    expect(positionSideToDirection('short')).toBe('down')
  })
})

describe('directionLabel', () => {
  it('uppercases the direction', () => {
    expect(directionLabel('up')).toBe('UP')
    expect(directionLabel('down')).toBe('DOWN')
  })
})

describe('tickerFromSymbol', () => {
  it('strips the perp suffix, dex prefix, and spot quote', () => {
    expect(tickerFromSymbol('BTC-PERP')).toBe('BTC')
    expect(tickerFromSymbol('xyz:AAPL')).toBe('AAPL')
    expect(tickerFromSymbol('HYPE/USDC')).toBe('HYPE')
    expect(tickerFromSymbol('sol')).toBe('SOL')
  })
})

describe('liquidationPriceText', () => {
  it('formats with the market precision', () => {
    expect(liquidationPriceText(94_102, makeMarket())).toBe('94,102')
  })

  it('returns null for an unknown / non-positive liquidation', () => {
    expect(liquidationPriceText(null, makeMarket())).toBeNull()
    expect(liquidationPriceText(0, makeMarket())).toBeNull()
  })
})

describe('formatLiquidationSentence', () => {
  it('says "drops below" for an UP bet and "rises above" for a DOWN bet (D16)', () => {
    expect(formatLiquidationSentence('up', 'BTC', '94,102')).toBe(
      'You lose this bet if BTC drops below $94,102',
    )
    expect(formatLiquidationSentence('down', 'SOL', '212.40')).toBe(
      'You lose this bet if SOL rises above $212.40',
    )
  })

  it('degrades to an honest fallback when the price is unknown', () => {
    expect(formatLiquidationSentence('up', 'BTC', null)).toBe(
      'You lose this bet if BTC moves too far against you',
    )
  })
})

describe('projectLiveBet', () => {
  it('projects a winning long into an UP bet with the liquidation prose', () => {
    const bet = projectLiveBet(makePosition(), makeMarket(), false)
    expect(bet).toMatchObject({
      symbol: 'BTC-PERP',
      ticker: 'BTC',
      direction: 'up',
      leverage: 10,
      profitUsd: 124,
      isWinning: true,
      isCashingOut: false,
      liquidationSentence: 'You lose this bet if BTC drops below $94,102',
    })
  })

  it('marks a negative-profit position as losing', () => {
    const bet = projectLiveBet(makePosition({ unrealizedPnlUsd: -12 }), makeMarket(), true)
    expect(bet.isWinning).toBe(false)
    expect(bet.isCashingOut).toBe(true)
  })

  it('falls back to the symbol ticker when the market is unknown', () => {
    const bet = projectLiveBet(makePosition({ symbol: 'SOL-PERP' }), undefined, false)
    expect(bet.ticker).toBe('SOL')
  })
})

describe('buildFullCloseRequest', () => {
  it('closes a long with a reduce-only full-size sell market order', () => {
    const request = buildFullCloseRequest(makePosition({ side: 'long', size: 0.5 }))
    expect(request).toMatchObject({
      orderType: 'market',
      symbol: 'BTC-PERP',
      side: 'sell',
      size: 0.5,
      reduceOnly: true,
    })
    expect(request.clientOrderId).toMatch(/^0xa99a/)
  })

  it('closes a short with a buy', () => {
    const request = buildFullCloseRequest(makePosition({ side: 'short' }))
    expect(request.side).toBe('buy')
  })
})

describe('isSettlementFill', () => {
  it('accepts a close fill that booked realised pnl', () => {
    expect(isSettlementFill(makeFill())).toBe(true)
  })

  it('rejects an open fill and a fill with no closedPnl', () => {
    expect(isSettlementFill(makeFill({ direction: 'Open Long' }))).toBe(false)
    expect(isSettlementFill(makeFill({ closedPnl: undefined }))).toBe(false)
  })
})

describe('projectSettledBet', () => {
  it('reads the original direction from a close-long fill', () => {
    const bet = projectSettledBet(makeFill({ direction: 'Close Long', closedPnl: 124 }))
    expect(bet).toMatchObject({ ticker: 'BTC', direction: 'up', profitUsd: 124, isWin: true })
  })

  it('reads a close-short fill as a DOWN bet and marks a loss', () => {
    const bet = projectSettledBet(makeFill({ direction: 'Close Short', closedPnl: -30 }))
    expect(bet).toMatchObject({ direction: 'down', profitUsd: -30, isWin: false })
  })
})

describe('mergeSettledBet', () => {
  it('prepends a settlement, newest first', () => {
    const older = makeFill({ identifier: 'a', timestamp: 1 })
    const newer = makeFill({ identifier: 'b', timestamp: 2 })
    const afterOlder = mergeSettledBet([], older)
    const merged = mergeSettledBet(afterOlder, newer)
    expect(merged.map((bet) => bet.id)).toEqual(['b', 'a'])
  })

  it('ignores non-settlement fills', () => {
    expect(mergeSettledBet([], makeFill({ direction: 'Open Long' }))).toEqual([])
  })

  it('dedups by fill id', () => {
    const first = mergeSettledBet([], makeFill({ identifier: 'x', closedPnl: 10 }))
    const second = mergeSettledBet(first, makeFill({ identifier: 'x', closedPnl: 20 }))
    expect(second).toHaveLength(1)
    expect(second[0].profitUsd).toBe(20)
  })

  it('caps the list at the settled limit', () => {
    let list: ReadonlyArray<SettledBet> = []
    for (let index = 0; index < SETTLED_BETS_LIMIT + 5; index += 1) {
      list = mergeSettledBet(list, makeFill({ identifier: `f${index}`, timestamp: index }))
    }
    expect(list).toHaveLength(SETTLED_BETS_LIMIT)
    expect(list[0].id).toBe(`f${SETTLED_BETS_LIMIT + 4}`)
  })
})
