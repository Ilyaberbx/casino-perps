import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { okAsync } from 'neverthrow'
import type { PlaceOrderRequest, PortfolioSnapshot, Trader } from '../../../../shared/domain'
import { useSimpleOrderTicket } from '../use-simple-order-ticket'
import { buildVenue, buildWrapper } from '../__fixtures__/order-entry-venue'

const FILLED = {
  kind: 'filled' as const,
  orderIdentifier: 'order-1',
  symbol: 'BTC-PERP',
  averagePrice: 60_000,
  filledSize: 1,
  timestamp: 1_700_000_000_000,
}

/** A funded snapshot. `perpsEquity` is passed separately so a test can build the
 *  UNIFIED shape (`accountValue: N, perpsEquity: 0`) — conflating the two is the
 *  fixture mistake that shipped the phantom `$0 available` bug once already
 *  (hyperliquid-account-modes.md §4). */
function fundedSnapshot(accountValue: number, perpsEquity: number): PortfolioSnapshot {
  return {
    accountValue,
    pnl: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
    perpsPnl: 0,
    volume: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
    spotEquity: 0,
    perpsEquity,
    fourteenDayVolume: 0,
    timestamp: 0,
  }
}

/** A funded account on a $60k BTC perp — enough buying power that `canSubmit`
 *  turns on once a size is entered. */
function renderTicket(
  placeOrder: Trader['placeOrder'] = vi.fn(() => okAsync(FILLED)),
  portfolio: PortfolioSnapshot = fundedSnapshot(10_000, 10_000),
) {
  const venue = buildVenue(placeOrder, { portfolio })
  return renderHook(() => useSimpleOrderTicket(), {
    wrapper: buildWrapper(venue, undefined, 60_000),
  })
}

describe('useSimpleOrderTicket', () => {
  it('opens as a market order sized in USD — you think in dollars, not coins', () => {
    const { result } = renderTicket()
    expect(result.current.form.orderType).toBe('market')
    expect(result.current.form.sizeUnit).toBe('usd')
    expect(result.current.isPriceTargetOn).toBe(false)
  })

  it('turning the price target on makes the order a limit, and off reverts it to market', () => {
    const { result } = renderTicket()

    act(() => result.current.togglePriceTarget())
    expect(result.current.isPriceTargetOn).toBe(true)
    expect(result.current.form.orderType).toBe('limit')

    act(() => result.current.togglePriceTarget())
    expect(result.current.isPriceTargetOn).toBe(false)
    expect(result.current.form.orderType).toBe('market')
  })

  it('drops the limit price when the price target is turned back off', () => {
    const { result } = renderTicket()
    act(() => result.current.togglePriceTarget())
    act(() => result.current.setPriceInput('58000'))
    expect(result.current.form.priceInput).toBe('58000')

    act(() => result.current.togglePriceTarget())

    // A stale limit price must never ride along on a market order.
    expect(result.current.form.priceInput).toBe('')
  })

  it('the primary action opens the review sheet and places nothing on its own', () => {
    const placeOrder = vi.fn<Trader['placeOrder']>(() => okAsync(FILLED))
    const { result } = renderTicket(placeOrder)
    act(() => result.current.setSizeInput('600'))

    act(() => result.current.openReview())

    expect(result.current.isReviewOpen).toBe(true)
    expect(placeOrder).not.toHaveBeenCalled()
  })

  it('confirming from the review submits the order and dismisses the sheet', () => {
    const placeOrder = vi.fn<Trader['placeOrder']>(() => okAsync(FILLED))
    const { result } = renderTicket(placeOrder)
    act(() => result.current.setSizeInput('600'))
    act(() => result.current.openReview())

    act(() => result.current.submit())

    expect(placeOrder).toHaveBeenCalledTimes(1)
    const request = placeOrder.mock.calls[0][0] as PlaceOrderRequest
    expect(request).toMatchObject({ orderType: 'market', symbol: 'BTC-PERP', side: 'buy' })
    expect(result.current.isReviewOpen).toBe(false)
  })

  it('closing the review leaves the draft intact so the size is not retyped', () => {
    const { result } = renderTicket()
    act(() => result.current.setSizeInput('600'))
    act(() => result.current.openReview())
    act(() => result.current.closeReview())

    expect(result.current.isReviewOpen).toBe(false)
    expect(result.current.form.sizeInput).toBe('600')
  })

  it('shows real buying power for a funded UNIFIED account, where perpsEquity is 0', () => {
    // A unified / portfolio-margin account reports perpsEquity 0 by design; the
    // funded figure lives in accountValue. Reading the wrong one renders a
    // phantom "$0 available" on a funded account and blocks the trade.
    const { result } = renderTicket(undefined, fundedSnapshot(15_000, 0))
    expect(result.current.availableToTrade).toBeGreaterThan(0)
    expect(result.current.availableUnit).toBe('usd')
  })

  it('leaves every Pro-only field on the default Simple never renders', () => {
    const { result } = renderTicket()
    // Simple suppresses these by not rendering them, so their defaults are what
    // reach the venue: no reduce-only, GTC, no entry TP/SL, venue slippage.
    expect(result.current.form.reduceOnly).toBe(false)
    expect(result.current.form.timeInForce).toBe('Gtc')
    expect(result.current.form.slippageInput).toBe('')
    expect(result.current.protection.enabled).toBe(false)
  })
})
