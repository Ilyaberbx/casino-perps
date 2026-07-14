import { describe, it, expect } from 'vitest'
import {
  buildFullCloseRequest,
  isCloseFill,
  liquidationPriceText,
  mergeClosedTrade,
  projectClosedTrade,
  projectOpenPosition,
  sideLabel,
  tickerFromSymbol,
} from '../my-bets.utils'
import { CLOSED_TRADES_LIMIT } from '../my-bets.constants'
import { makeFill, makeMarket, makePosition } from '../__fixtures__/venue'
import type { ClosedTradeRow } from '../my-bets.types'

describe('sideLabel', () => {
  it('uppercases the position side', () => {
    expect(sideLabel('long')).toBe('LONG')
    expect(sideLabel('short')).toBe('SHORT')
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

describe('projectOpenPosition', () => {
  it('projects a profitable long, exposing the liquidation price as a number', () => {
    const position = projectOpenPosition(makePosition(), makeMarket(), false)
    expect(position).toMatchObject({
      symbol: 'BTC-PERP',
      ticker: 'BTC',
      side: 'long',
      leverage: 10,
      pnlUsd: 124,
      isUp: true,
      isClosing: false,
      liquidationPriceText: '94,102',
    })
  })

  it('marks a negative-PnL position as down', () => {
    const position = projectOpenPosition(makePosition({ unrealizedPnlUsd: -12 }), makeMarket(), true)
    expect(position.isUp).toBe(false)
    expect(position.isClosing).toBe(true)
  })

  it('carries a null liquidation through rather than inventing one', () => {
    const position = projectOpenPosition(
      makePosition({ liquidationPrice: null }),
      makeMarket(),
      false,
    )
    expect(position.liquidationPriceText).toBeNull()
  })

  it('falls back to the symbol ticker when the market is unknown', () => {
    const position = projectOpenPosition(makePosition({ symbol: 'SOL-PERP' }), undefined, false)
    expect(position.ticker).toBe('SOL')
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

describe('isCloseFill', () => {
  it('accepts a close fill that booked realised pnl', () => {
    expect(isCloseFill(makeFill())).toBe(true)
  })

  it('rejects an open fill and a fill with no closedPnl', () => {
    expect(isCloseFill(makeFill({ direction: 'Open Long' }))).toBe(false)
    expect(isCloseFill(makeFill({ closedPnl: undefined }))).toBe(false)
  })
})

describe('projectClosedTrade', () => {
  it('reads the closed side from a close-long fill', () => {
    const trade = projectClosedTrade(makeFill({ direction: 'Close Long', closedPnl: 124 }))
    expect(trade).toMatchObject({ ticker: 'BTC', side: 'long', pnlUsd: 124, isUp: true })
  })

  it('reads a close-short fill as a short and marks a loss', () => {
    const trade = projectClosedTrade(makeFill({ direction: 'Close Short', closedPnl: -30 }))
    expect(trade).toMatchObject({ side: 'short', pnlUsd: -30, isUp: false })
  })
})

describe('mergeClosedTrade', () => {
  it('prepends a close, newest first', () => {
    const older = makeFill({ identifier: 'a', timestamp: 1 })
    const newer = makeFill({ identifier: 'b', timestamp: 2 })
    const afterOlder = mergeClosedTrade([], older)
    const merged = mergeClosedTrade(afterOlder, newer)
    expect(merged.map((trade) => trade.id)).toEqual(['b', 'a'])
  })

  it('ignores fills that did not close anything', () => {
    expect(mergeClosedTrade([], makeFill({ direction: 'Open Long' }))).toEqual([])
  })

  it('dedups by fill id', () => {
    const first = mergeClosedTrade([], makeFill({ identifier: 'x', closedPnl: 10 }))
    const second = mergeClosedTrade(first, makeFill({ identifier: 'x', closedPnl: 20 }))
    expect(second).toHaveLength(1)
    expect(second[0].pnlUsd).toBe(20)
  })

  it('caps the list at the history limit', () => {
    let list: ReadonlyArray<ClosedTradeRow> = []
    for (let index = 0; index < CLOSED_TRADES_LIMIT + 5; index += 1) {
      list = mergeClosedTrade(list, makeFill({ identifier: `f${index}`, timestamp: index }))
    }
    expect(list).toHaveLength(CLOSED_TRADES_LIMIT)
    expect(list[0].id).toBe(`f${CLOSED_TRADES_LIMIT + 4}`)
  })
})
