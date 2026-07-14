import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { okAsync, errAsync } from 'neverthrow'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { VenueContext } from '../../../../shared/providers/venue-provider/venue-provider.context'
import { SelectedMarketContext } from '../../../providers/selected-market-provider/selected-market-provider.context'
import { LeverageMarginProvider } from '../../../providers/leverage-margin'
import { FakeOrderIntentProvider } from '../../../providers/order-intent-provider/__fixtures__/fake-order-intent-provider'
import { SpectateContext } from '@/modules/spectate/providers/spectate-provider/spectate-provider.context'
import type { OrderIntent } from '../../../trading.types'
import type { Market, PortfolioSnapshot, Trader } from '../../../../shared/domain'
import { PlaceOrderError } from '../../../../shared/domain'
import { toast } from '@/modules/shared/services/toast'
import { useOrderEntry } from '../use-order-entry'
import { DEFAULT_PRICE, DEFAULT_SIZE } from '../order-entry.constants'
import {
  DEFAULT_PERP_MARKET,
  SPOT_MARKET,
  buildPosition,
  buildSpectate,
  buildSpotBalance,
  buildVenue,
  buildWrapper,
  withMarketContext,
} from '../__fixtures__/order-entry-venue'


describe('useOrderEntry', () => {
  it('disables submit when size is empty or zero', () => {
    const venue = buildVenue(vi.fn())
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    expect(result.current.validation.canSubmit).toBe(false)
    act(() => result.current.setSizeInput('0'))
    expect(result.current.validation.canSubmit).toBe(false)
  })

  it('enables submit for a valid market order and calls placeOrder with the selected market', async () => {
    const placeOrder: Trader['placeOrder'] = vi.fn(() =>
      okAsync({
        kind: 'filled' as const,
        orderIdentifier: 'order-1',
        symbol: 'BTC-PERP',
        averagePrice: 60_000,
        filledSize: 1,
        timestamp: 1,
      }),
    )
    const venue = buildVenue(placeOrder)
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    act(() => {
      result.current.setSizeInput('1')
    })
    expect(result.current.validation.canSubmit).toBe(true)
    await act(async () => {
      result.current.submit()
    })
    expect(placeOrder).toHaveBeenCalledTimes(1)
    expect(placeOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'BTC-PERP',
        size: 1,
        orderType: 'market',
      }),
    )
  })

  // Regression: the order sheet never reset after a successful placement — the
  // entered size lingered. A successful submit now clears the entry fields while
  // preserving the sticky selections (order type, side, unit, TIF, randomize).
  it('resets the entry fields after a successful placeOrder, preserving order type + side', async () => {
    const placeOrder: Trader['placeOrder'] = vi.fn(() =>
      okAsync({
        kind: 'resting' as const,
        orderIdentifier: 'o1',
        symbol: 'BTC-PERP',
        timestamp: 1,
      }),
    )
    const venue = buildVenue(placeOrder)
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    act(() => {
      result.current.setOrderType('limit')
      result.current.setSide('sell')
      result.current.setSizeInput('3')
      result.current.setPriceInput('64000')
    })
    expect(result.current.form.sizeInput).toBe('3')
    await act(async () => {
      result.current.submit()
    })
    // Entry fields cleared…
    expect(result.current.form.sizeInput).toBe(DEFAULT_SIZE)
    expect(result.current.form.priceInput).toBe('')
    // …sticky selections preserved.
    expect(result.current.form.orderType).toBe('limit')
    expect(result.current.form.side).toBe('sell')
  })

  it('does not reset the form when placeOrder fails', async () => {
    const placeOrder: Trader['placeOrder'] = vi.fn(() =>
      errAsync(new PlaceOrderError('rejected', 'insufficient margin')),
    )
    const venue = buildVenue(placeOrder)
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    act(() => result.current.setSizeInput('3'))
    await act(async () => {
      result.current.submit()
    })
    expect(result.current.form.sizeInput).toBe('3')
  })

  it('requires a positive limit price in limit mode', () => {
    const venue = buildVenue(vi.fn())
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    act(() => {
      result.current.setOrderType('limit')
      result.current.setSizeInput('1')
    })
    expect(result.current.validation.canSubmit).toBe(false)
    act(() => result.current.setPriceInput('100'))
    expect(result.current.validation.canSubmit).toBe(true)
  })

  it('fills the limit price from the market mid via setPriceFromMid', () => {
    const venue = buildVenue(vi.fn())
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate(), 60_000),
    })
    expect(result.current.markPrice).toBe(60_000)
    act(() => {
      result.current.setOrderType('limit')
      result.current.setPriceFromMid()
    })
    expect(result.current.form.priceInput).toBe('60000')
  })

  it('setPriceFromMid is a no-op when the mid is unknown', () => {
    const venue = buildVenue(vi.fn())
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    expect(result.current.markPrice).toBe(0)
    act(() => {
      result.current.setOrderType('limit')
      result.current.setPriceFromMid()
    })
    expect(result.current.form.priceInput).toBe('')
  })

  it('exposes isSpectating and stopSpectating from the spectate session', () => {
    const stopSpectating = vi.fn()
    const venue = buildVenue(vi.fn())
    const spectate = buildSpectate({ isSpectating: true, stopSpectating })
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, spectate),
    })
    expect(result.current.isSpectating).toBe(true)
    act(() => result.current.stopSpectating())
    expect(stopSpectating).toHaveBeenCalledTimes(1)
  })

  it('blocks placeOrder while spectating even for a valid order', async () => {
    const placeOrder = vi.fn(() =>
      okAsync({
        kind: 'filled' as const,
        orderIdentifier: 'order-1',
        symbol: 'BTC-PERP',
        averagePrice: 60_000,
        filledSize: 1,
        timestamp: 1,
      }),
    )
    const venue = buildVenue(placeOrder)
    const spectate = buildSpectate({ isSpectating: true })
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, spectate),
    })
    act(() => {
      result.current.setSizeInput('1')
    })
    expect(result.current.validation.canSubmit).toBe(true)
    await act(async () => {
      result.current.submit()
    })
    expect(placeOrder).not.toHaveBeenCalled()
  })

  it('exits spectating on Ctrl+X and restores normal order entry', async () => {
    const stopSpectating = vi.fn()
    const placeOrder = vi.fn(() =>
      okAsync({
        kind: 'filled' as const,
        orderIdentifier: 'order-1',
        symbol: 'BTC-PERP',
        averagePrice: 60_000,
        filledSize: 1,
        timestamp: 1,
      }),
    )
    const venue = buildVenue(placeOrder)
    const spectate = buildSpectate({ isSpectating: true, stopSpectating })
    const { rerender } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, spectate),
    })
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', ctrlKey: true }))
    })
    expect(stopSpectating).toHaveBeenCalledTimes(1)

    // Spectating ended → normal entry restores: placeOrder fires again.
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate({ isSpectating: false })),
    })
    rerender()
    act(() => {
      result.current.setSizeInput('1')
    })
    await act(async () => {
      result.current.submit()
    })
    expect(placeOrder).toHaveBeenCalledTimes(1)
  })

  it('does not exit spectating on Ctrl+X when not spectating', () => {
    const stopSpectating = vi.fn()
    const venue = buildVenue(vi.fn())
    const spectate = buildSpectate({ isSpectating: false, stopSpectating })
    renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue, spectate) })
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', ctrlKey: true }))
    })
    expect(stopSpectating).not.toHaveBeenCalled()
  })

  it('removes the Ctrl+X listener on unmount', () => {
    const stopSpectating = vi.fn()
    const venue = buildVenue(vi.fn())
    const spectate = buildSpectate({ isSpectating: true, stopSpectating })
    const { unmount } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, spectate),
    })
    unmount()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', ctrlKey: true }))
    })
    expect(stopSpectating).not.toHaveBeenCalled()
  })

  it('shows a pending toast keyed by cloid then a success toast on the same id', async () => {
    const showSpy = vi.spyOn(toast, 'show')
    const placeOrder: Trader['placeOrder'] = vi.fn(() =>
      okAsync({
        kind: 'filled' as const,
        orderIdentifier: 'order-1',
        symbol: 'BTC-PERP',
        averagePrice: 60_000,
        filledSize: 1,
        timestamp: 1,
      }),
    )
    const venue = buildVenue(placeOrder)
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    act(() => result.current.setSizeInput('1'))
    await act(async () => {
      result.current.submit()
    })
    const pending = showSpy.mock.calls[0][0]
    const terminal = showSpy.mock.calls[1][0]
    expect(pending.variant).toBe('info')
    expect(terminal.variant).toBe('success')
    expect(terminal.id).toBe(pending.id)
    showSpy.mockRestore()
  })

  it('shows an error toast with the raw rejection reason on the cloid id', async () => {
    const showSpy = vi.spyOn(toast, 'show')
    const placeOrder: Trader['placeOrder'] = vi.fn(() =>
      errAsync(new PlaceOrderError('rejected', 'insufficient margin')),
    )
    const venue = buildVenue(placeOrder)
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    act(() => result.current.setSizeInput('1'))
    await act(async () => {
      result.current.submit()
    })
    const terminal = showSpy.mock.calls[1][0]
    expect(terminal.variant).toBe('error')
    expect(terminal.description).toBe('insufficient margin')
    expect(result.current.errorMessage).toBe('insufficient margin')
    showSpy.mockRestore()
  })

  it('reflects the venue trigger-order support flag', () => {
    const withTriggers = buildVenue(vi.fn(), { supportsTriggerOrders: true })
    const without = buildVenue(vi.fn())
    const a = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(withTriggers) })
    const b = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(without) })
    expect(a.result.current.supportsTriggerOrders).toBe(true)
    expect(b.result.current.supportsTriggerOrders).toBe(false)
  })

  it('threads enabled entry TP/SL legs into placeOrder', async () => {
    const placeOrder: Trader['placeOrder'] = vi.fn(() =>
      okAsync({
        kind: 'filled' as const,
        orderIdentifier: 'order-1',
        symbol: 'BTC-PERP',
        averagePrice: 60_000,
        filledSize: 1,
        timestamp: 1,
      }),
    )
    const venue = buildVenue(placeOrder, { supportsTriggerOrders: true })
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    act(() => {
      result.current.setSizeInput('1')
      result.current.setProtectionEnabled(true)
      result.current.setProtectionLegPrice('takeProfit', '70000')
      result.current.setProtectionLegPrice('stopLoss', '55000')
    })
    await act(async () => {
      result.current.submit()
    })
    expect(placeOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 70000 } },
        stopLoss: { kind: 'stop-loss', trigger: { type: 'price', price: 55000 } },
      }),
    )
  })

  it('blocks submit when an enabled TP/SL leg has an unusable value', () => {
    const venue = buildVenue(vi.fn(), { supportsTriggerOrders: true })
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    act(() => {
      result.current.setSizeInput('1')
      result.current.setProtectionEnabled(true)
      result.current.setProtectionLegPrice('takeProfit', 'abc')
    })
    expect(result.current.validation.canSubmit).toBe(false)
    expect(result.current.validation.isProtectionValid).toBe(false)
  })

  it('carries the default slippage tolerance on a market order', async () => {
    const placeOrder: Trader['placeOrder'] = vi.fn(() =>
      okAsync({
        kind: 'filled' as const,
        orderIdentifier: 'o1',
        symbol: 'BTC-PERP',
        averagePrice: 60_000,
        filledSize: 1,
        timestamp: 1,
      }),
    )
    const venue = buildVenue(placeOrder)
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    act(() => result.current.setSizeInput('1'))
    await act(async () => {
      result.current.submit()
    })
    expect(placeOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderType: 'market', slippageTolerance: 0.08 }),
    )
  })

  it('overrides the slippage tolerance from the advanced field', async () => {
    const placeOrder: Trader['placeOrder'] = vi.fn(() =>
      okAsync({
        kind: 'filled' as const,
        orderIdentifier: 'o1',
        symbol: 'BTC-PERP',
        averagePrice: 60_000,
        filledSize: 1,
        timestamp: 1,
      }),
    )
    const venue = buildVenue(placeOrder)
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    act(() => {
      result.current.setSizeInput('1')
      result.current.setSlippageInput('2')
    })
    await act(async () => {
      result.current.submit()
    })
    expect(placeOrder).toHaveBeenCalledWith(
      expect.objectContaining({ slippageTolerance: 0.02 }),
    )
  })

  it('threads the reduce-only flag into the order request', async () => {
    const placeOrder: Trader['placeOrder'] = vi.fn(() =>
      okAsync({
        kind: 'filled' as const,
        orderIdentifier: 'o1',
        symbol: 'BTC-PERP',
        averagePrice: 60_000,
        filledSize: 1,
        timestamp: 1,
      }),
    )
    const venue = buildVenue(placeOrder)
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    act(() => {
      result.current.setSizeInput('1')
      result.current.setReduceOnly(true)
    })
    await act(async () => {
      result.current.submit()
    })
    expect(placeOrder).toHaveBeenCalledWith(expect.objectContaining({ reduceOnly: true }))
  })

  it('carries the selected time-in-force on a limit order', async () => {
    const placeOrder: Trader['placeOrder'] = vi.fn(() =>
      okAsync({
        kind: 'resting' as const,
        orderIdentifier: 'o1',
        symbol: 'BTC-PERP',
        timestamp: 1,
      }),
    )
    const venue = buildVenue(placeOrder)
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    act(() => {
      result.current.setOrderType('limit')
      result.current.setSizeInput('1')
      result.current.setPriceInput('100')
      result.current.setTimeInForce('Ioc')
    })
    await act(async () => {
      result.current.submit()
    })
    expect(placeOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderType: 'limit', timeInForce: 'Ioc' }),
    )
  })

  it('exposes the venue stop + twap capability flags', () => {
    const venue = buildVenue(vi.fn(), { supportsStopOrders: true, supportsTwap: true })
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    expect(result.current.supportsStopOrders).toBe(true)
    expect(result.current.supportsTwap).toBe(true)
  })

  it('requires a positive stop price for a stop-market order', () => {
    const venue = buildVenue(vi.fn(), { supportsStopOrders: true })
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    act(() => {
      result.current.setOrderType('stop-market')
      result.current.setSizeInput('1')
    })
    expect(result.current.validation.canSubmit).toBe(false)
    act(() => result.current.setStopPriceInput('65000'))
    expect(result.current.validation.canSubmit).toBe(true)
  })

  it('builds a stop-market request carrying the stop price and default slippage', async () => {
    const placeOrder: Trader['placeOrder'] = vi.fn(() =>
      okAsync({
        kind: 'resting' as const,
        orderIdentifier: 'o1',
        symbol: 'BTC-PERP',
        timestamp: 1,
      }),
    )
    const venue = buildVenue(placeOrder, { supportsStopOrders: true })
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    act(() => {
      result.current.setOrderType('stop-market')
      result.current.setSizeInput('2')
      result.current.setStopPriceInput('65000')
    })
    await act(async () => {
      result.current.submit()
    })
    expect(placeOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderType: 'stop-market',
        stopPrice: 65000,
        size: 2,
        slippageTolerance: 0.08,
      }),
    )
  })

  it('requires both stop and limit price for a stop-limit order', () => {
    const venue = buildVenue(vi.fn(), { supportsStopOrders: true })
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    act(() => {
      result.current.setOrderType('stop-limit')
      result.current.setSizeInput('1')
      result.current.setStopPriceInput('65000')
    })
    expect(result.current.validation.canSubmit).toBe(false)
    act(() => result.current.setPriceInput('64900'))
    expect(result.current.validation.canSubmit).toBe(true)
  })

  it('builds a stop-limit request carrying both prices', async () => {
    const placeOrder: Trader['placeOrder'] = vi.fn(() =>
      okAsync({
        kind: 'resting' as const,
        orderIdentifier: 'o1',
        symbol: 'BTC-PERP',
        timestamp: 1,
      }),
    )
    const venue = buildVenue(placeOrder, { supportsStopOrders: true })
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    act(() => {
      result.current.setOrderType('stop-limit')
      result.current.setSizeInput('1')
      result.current.setStopPriceInput('65000')
      result.current.setPriceInput('64900')
    })
    await act(async () => {
      result.current.submit()
    })
    expect(placeOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderType: 'stop-limit', stopPrice: 65000, price: 64900 }),
    )
  })

  it('validates TWAP running time within [5m, 24h]', () => {
    const venue = buildVenue(vi.fn(), { supportsTwap: true })
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    act(() => {
      result.current.setOrderType('twap')
      result.current.setSizeInput('10')
    })
    // Defaults to 0h / 30m → valid
    expect(result.current.validation.canSubmit).toBe(true)
    act(() => {
      result.current.setTwapHours('0')
      result.current.setTwapMinutes('4')
    })
    expect(result.current.validation.isTwapDurationValid).toBe(false)
    act(() => {
      result.current.setTwapHours('25')
      result.current.setTwapMinutes('0')
    })
    expect(result.current.validation.isTwapDurationValid).toBe(false)
  })

  it('computes the twap estimate footer (30m → 61 orders at 30s)', () => {
    const venue = buildVenue(vi.fn(), { supportsTwap: true })
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    act(() => {
      result.current.setOrderType('twap')
      result.current.setSizeInput('61')
      result.current.setTwapHours('0')
      result.current.setTwapMinutes('30')
    })
    const estimates = result.current.estimates
    expect(estimates.kind).toBe('twap')
    if (estimates.kind !== 'twap') throw new Error('expected twap estimates')
    expect(estimates.frequencySeconds).toBe(30)
    expect(estimates.runtimeMinutes).toBe(30)
    expect(estimates.numberOfOrders).toBe(61)
    expect(estimates.sizePerSuborder).toBeCloseTo(1, 5)
  })

  // Regression: the % slider read 0 for a TWAP draft because `sizeFraction`
  // back-computed the coin size only for `linear` estimates. The TWAP estimate
  // now carries `notional`, so the slider tracks a TWAP size like any other.
  it('reflects a positive TWAP size on the % slider (notional drives sizeFraction)', () => {
    // Available 100, price 100, leverage 1 → maxCoin = 1. A 0.5-coin TWAP order
    // is half of capacity → fraction 0.5.
    const fundedSnapshot: PortfolioSnapshot = {
      accountValue: 100,
      pnl: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
      perpsPnl: 0,
      volume: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
      spotEquity: 0,
      perpsEquity: 100,
      fourteenDayVolume: 0,
      timestamp: 0,
    }
    const venue = buildVenue(vi.fn(), { supportsTwap: true, portfolio: fundedSnapshot })
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate(), 100),
    })
    act(() => {
      result.current.setOrderType('twap')
      result.current.setSizeInput('0.5')
    })
    expect(result.current.estimates.kind).toBe('twap')
    expect(result.current.sizeFraction).toBeCloseTo(0.5, 5)
  })

  it('builds a twap request with the duration and randomize flag', async () => {
    const placeOrder: Trader['placeOrder'] = vi.fn(() =>
      okAsync({
        kind: 'resting' as const,
        orderIdentifier: 'o1',
        symbol: 'BTC-PERP',
        timestamp: 1,
      }),
    )
    const venue = buildVenue(placeOrder, { supportsTwap: true })
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    act(() => {
      result.current.setOrderType('twap')
      result.current.setSizeInput('10')
      result.current.setTwapHours('1')
      result.current.setTwapMinutes('0')
      result.current.setRandomize(true)
    })
    await act(async () => {
      result.current.submit()
    })
    expect(placeOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderType: 'twap', durationMinutes: 60, randomize: true }),
    )
  })

  it('clears stop/limit fields when switching back to market', async () => {
    const placeOrder: Trader['placeOrder'] = vi.fn(() =>
      okAsync({
        kind: 'filled' as const,
        orderIdentifier: 'o1',
        symbol: 'BTC-PERP',
        averagePrice: 60_000,
        filledSize: 1,
        timestamp: 1,
      }),
    )
    const venue = buildVenue(placeOrder, { supportsStopOrders: true })
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    act(() => {
      result.current.setOrderType('stop-limit')
      result.current.setSizeInput('1')
      result.current.setStopPriceInput('65000')
      result.current.setPriceInput('64900')
    })
    act(() => {
      result.current.setOrderType('market')
    })
    expect(result.current.form.stopPriceInput).toBe('')
    expect(result.current.form.priceInput).toBe('')
    expect(result.current.form.sizeInput).toBe('1')
    await act(async () => {
      result.current.submit()
    })
    const request = (placeOrder as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(request).toMatchObject({ orderType: 'market', size: 1 })
    expect(request).not.toHaveProperty('stopPrice')
    expect(request).not.toHaveProperty('price')
  })

  // Regression: unified / portfolio-margin Hyperliquid accounts collapse
  // `perpsEquity` to 0 by design (ADR-0033 D-4); the funded figure lives in
  // `accountValue`. Available-to-Trade must read `accountValue`, or a funded
  // unified account shows $0 available. See hyperliquid-account-modes.md §3.
  it('reads available-to-trade from accountValue for a funded unified account (perpsEquity 0)', () => {
    const unifiedSnapshot: PortfolioSnapshot = {
      accountValue: 15,
      pnl: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
      perpsPnl: 0,
      volume: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
      spotEquity: 15,
      perpsEquity: 0,
      fourteenDayVolume: 0,
      timestamp: 0,
    }
    const venue = buildVenue(vi.fn(), { portfolio: unifiedSnapshot })
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    expect(result.current.availableToTrade).toBe(15)
  })

  it('reads available-to-trade from accountValue for a classic account (accountValue == perpsEquity)', () => {
    const classicSnapshot: PortfolioSnapshot = {
      accountValue: 5_000,
      pnl: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
      perpsPnl: 0,
      volume: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
      spotEquity: 0,
      perpsEquity: 5_000,
      fourteenDayVolume: 0,
      timestamp: 0,
    }
    const venue = buildVenue(vi.fn(), { portfolio: classicSnapshot })
    const { result } = renderHook(() => useOrderEntry(), { wrapper: buildWrapper(venue) })
    expect(result.current.availableToTrade).toBe(5_000)
  })

  // ── Fix #1: $10 minimum order value + Margin sizing ──────────────────────

  it('blocks submit and surfaces a hint when the order value is below the $10 minimum', () => {
    // markPrice 100, leverage 1 (default): a 0.05-coin order is $5 notional.
    const venue = buildVenue(vi.fn())
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate(), 100),
    })
    act(() => result.current.setSizeInput('0.05'))
    expect(result.current.validation.isSizeValid).toBe(true)
    expect(result.current.validation.isOrderValueValid).toBe(false)
    expect(result.current.validation.canSubmit).toBe(false)
    expect(result.current.minOrderValueHint).toMatch(/\$10/)
  })

  it('clears the $10 guard once the order value reaches the minimum', () => {
    const venue = buildVenue(vi.fn())
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate(), 100),
    })
    act(() => result.current.setSizeInput('0.1')) // 0.1 × 100 = $10
    expect(result.current.validation.isOrderValueValid).toBe(true)
    expect(result.current.validation.canSubmit).toBe(true)
    expect(result.current.minOrderValueHint).toBeNull()
  })

  it('exempts reduce-only / closing orders from the $10 minimum', () => {
    const venue = buildVenue(vi.fn())
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate(), 100),
    })
    act(() => {
      result.current.setSizeInput('0.05') // $5 — below the floor
      result.current.setReduceOnly(true)
    })
    expect(result.current.validation.isOrderValueValid).toBe(true)
    expect(result.current.validation.canSubmit).toBe(true)
    expect(result.current.minOrderValueHint).toBeNull()
  })

  // The core fix: order entry reads the SAME leverage the badge set (shared via
  // LeverageMarginProvider, seeded here from the positions snapshot). The USD
  // field is the MARGIN (collateral), not the notional: at 5×, MAX margin =
  // full available 100, and Order Value = margin × leverage = 500.
  it('treats the USD amount as margin: MAX commits the full available margin (100), order value = margin × leverage', () => {
    const fundedSnapshot: PortfolioSnapshot = {
      accountValue: 100,
      pnl: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
      perpsPnl: 0,
      volume: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
      spotEquity: 0,
      perpsEquity: 100,
      fourteenDayVolume: 0,
      timestamp: 0,
    }
    const venue = buildVenue(vi.fn(), { portfolio: fundedSnapshot, positions: [buildPosition(5)] })
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate(), 100),
    })
    // Two acts: the fraction setter rebinds to the 'usd' unit only after the
    // unit-change render commits.
    act(() => result.current.setSizeUnit('usd'))
    act(() => result.current.setSizeFromBuyingPowerFraction(1)) // MAX
    // MAX in margin mode commits the full available margin (100), not the $500
    // notional — the field is collateral.
    expect(result.current.form.sizeInput).toBe('100')
    if (result.current.estimates.kind !== 'linear') throw new Error('expected linear estimates')
    // Order Value 500 = Margin 100 × leverage 5.
    expect(result.current.estimates.notional).toBe(500)
    expect(result.current.estimates.margin).toBe(100)
  })

  it('converts the typed amount when the unit toggle flips, holding the order fixed (coin ⇄ margin)', () => {
    const venue = buildVenue(vi.fn(), { positions: [buildPosition(5)] })
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate(), 100),
    })
    // 1 coin at price 100, 5× → margin = (1 × 100) / 5 = $20.
    act(() => result.current.setSizeInput('1'))
    act(() => result.current.setSizeUnit('usd'))
    expect(result.current.form.sizeInput).toBe('20')
    if (result.current.estimates.kind !== 'linear') throw new Error('expected linear estimates')
    expect(result.current.estimates.notional).toBe(100) // 1 coin × 100, unchanged by the switch
    expect(result.current.estimates.margin).toBe(20)
    // Flip back — $20 margin buys exactly 1 coin again (round-trip stable).
    act(() => result.current.setSizeUnit('coin'))
    expect(result.current.form.sizeInput).toBe('1')
  })

  it('holds the entered margin fixed across leverage: order value scales with leverage', () => {
    // Same $20 margin renders a 5×-scaled order at 5× and a 10×-scaled order at
    // 10× — the margin string is the anchor; the position (coin / order value)
    // is what moves when leverage switches.
    const at5 = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(buildVenue(vi.fn(), { positions: [buildPosition(5)] }), buildSpectate(), 100),
    })
    act(() => at5.result.current.setSizeUnit('usd'))
    act(() => at5.result.current.setSizeInput('20'))
    if (at5.result.current.estimates.kind !== 'linear') throw new Error('expected linear estimates')
    expect(at5.result.current.estimates.margin).toBe(20)
    expect(at5.result.current.estimates.notional).toBe(100)

    const at10 = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(buildVenue(vi.fn(), { positions: [buildPosition(10)] }), buildSpectate(), 100),
    })
    act(() => at10.result.current.setSizeUnit('usd'))
    act(() => at10.result.current.setSizeInput('20'))
    if (at10.result.current.estimates.kind !== 'linear') throw new Error('expected linear estimates')
    expect(at10.result.current.estimates.margin).toBe(20)
    expect(at10.result.current.estimates.notional).toBe(200)
  })

  // Post-ADR-0035: the venue authors the min-notional copy and `trading/`
  // renders it verbatim (D-3). The hint still blocks submit and renders in the
  // same place; the venue's message references the $10 floor (the leverage-aware
  // margin breakdown was a trading-side embellishment that left with the moved
  // size-conversion math). Leverage still drives the blocking notional via the
  // draft, so the $5 order at 5× is still gated.
  it('surfaces the venue $10 hint (leverage drives the blocking notional)', () => {
    const venue = buildVenue(vi.fn(), { positions: [buildPosition(5)] })
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate(), 100),
    })
    act(() => result.current.setSizeInput('0.05')) // 0.05 × 100 = $5 order, below $10
    expect(result.current.validation.isOrderValueValid).toBe(false)
    expect(result.current.validation.canSubmit).toBe(false)
    expect(result.current.minOrderValueHint).toMatch(/\$10/)
  })

  // ── Fix #2: Spot trading ─────────────────────────────────────────────────

  it('flags a spot market via isSpot', () => {
    const venue = buildVenue(vi.fn(), { balances: [buildSpotBalance('USDC', 100)] })
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate(), 2, SPOT_MARKET),
    })
    expect(result.current.isSpot).toBe(true)
  })

  it('sizes a spot BUY off the USDC spot balance (USDC ÷ price)', () => {
    // USDC available 100, price 2 → max 50 coin.
    const venue = buildVenue(vi.fn(), { balances: [buildSpotBalance('USDC', 100)] })
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate(), 2, SPOT_MARKET),
    })
    expect(result.current.availableUnit).toBe('usd')
    expect(result.current.availableToTrade).toBe(100)
    act(() => result.current.setSizeFromBuyingPowerFraction(1))
    expect(result.current.form.sizeInput).toBe('50')
  })

  it('sizes a spot SELL off base-token holdings, reported in coin', () => {
    const venue = buildVenue(vi.fn(), { balances: [buildSpotBalance('PURR', 30)] })
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate(), 2, SPOT_MARKET),
    })
    act(() => result.current.setSide('sell'))
    expect(result.current.availableUnit).toBe('coin')
    expect(result.current.availableToTrade).toBe(30)
    act(() => result.current.setSizeFromBuyingPowerFraction(1))
    expect(result.current.form.sizeInput).toBe('30')
  })

  it('applies the $10 minimum on spot too', () => {
    const venue = buildVenue(vi.fn(), { balances: [buildSpotBalance('USDC', 100)] })
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate(), 2, SPOT_MARKET),
    })
    act(() => result.current.setSizeInput('1')) // 1 × 2 = $2 < $10
    expect(result.current.validation.isOrderValueValid).toBe(false)
    expect(result.current.validation.canSubmit).toBe(false)
  })

  // ── L1: slider size respects the active market's szDecimals ───────────────
  // The slider must round its coin size to the market's lot precision
  // (`szDecimals` recovered from `stepSize = 10^-szDecimals`), so a valid slider
  // position never emits a size the venue's lot-step validator rejects. The bug:
  // a hardcoded 6-dp round emitted e.g. 0.333333 on a 1-dp (ETH) market.

  // A 1-dp market — stepSize 0.1 → szDecimals 1.
  const ONE_DP_MARKET: Market = {
    symbol: 'ETH-PERP',
    baseAsset: 'ETH',
    quoteAsset: 'USD',
    venue: 'mock',
    tickSize: 0.1,
    stepSize: 0.1,
    marketType: 'perp',
    hlCoin: 'ETH',
  }

  function decimalsOf(value: string): number {
    const dot = value.indexOf('.')
    return dot === -1 ? 0 : value.length - dot - 1
  }

  it('rounds the slider coin size to a 1-dp market lot step (no over-precision)', () => {
    // Available 100, price 30, leverage 1 → maxCoin = 100/30 = 3.333333.
    // A 0.5 fraction yields 1.666666… coin — must round to 1 dp (1.7), not 6 dp.
    const fundedSnapshot: PortfolioSnapshot = {
      accountValue: 100,
      pnl: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
      perpsPnl: 0,
      volume: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
      spotEquity: 0,
      perpsEquity: 100,
      fourteenDayVolume: 0,
      timestamp: 0,
    }
    const venue = buildVenue(vi.fn(), { portfolio: fundedSnapshot })
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate(), 30, ONE_DP_MARKET),
    })
    act(() => result.current.setSizeFromBuyingPowerFraction(0.5))
    expect(decimalsOf(result.current.form.sizeInput)).toBeLessThanOrEqual(1)
  })

  it('rounds the slider coin size to a 3-dp market lot step (szDecimals > 1)', () => {
    // DEFAULT_PERP_MARKET has stepSize 0.001 → szDecimals 3.
    const fundedSnapshot: PortfolioSnapshot = {
      accountValue: 100,
      pnl: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
      perpsPnl: 0,
      volume: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
      spotEquity: 0,
      perpsEquity: 100,
      fourteenDayVolume: 0,
      timestamp: 0,
    }
    const venue = buildVenue(vi.fn(), { portfolio: fundedSnapshot })
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate(), 7, DEFAULT_PERP_MARKET),
    })
    act(() => result.current.setSizeFromBuyingPowerFraction(0.5))
    expect(decimalsOf(result.current.form.sizeInput)).toBeLessThanOrEqual(3)
  })

  it('leaves the USD (margin) slider value unchanged by the szDecimals rounding', () => {
    // USD-unit MAX commits the full available margin (100) — a 2-dp USD figure,
    // not a coin lot. The szDecimals path must not touch the quote/USD branch.
    const fundedSnapshot: PortfolioSnapshot = {
      accountValue: 100,
      pnl: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
      perpsPnl: 0,
      volume: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
      spotEquity: 0,
      perpsEquity: 100,
      fourteenDayVolume: 0,
      timestamp: 0,
    }
    const venue = buildVenue(vi.fn(), { portfolio: fundedSnapshot, positions: [buildPosition(5)] })
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate(), 30, ONE_DP_MARKET),
    })
    act(() => result.current.setSizeUnit('usd'))
    act(() => result.current.setSizeFromBuyingPowerFraction(1))
    expect(result.current.form.sizeInput).toBe('100')
  })

  // ── L2: full form reset on market identity change ─────────────────────────
  // Switching the active market (symbol/coin) must reset the ENTIRE ticket to
  // its initial state — size, leverage, price/stop, slippage, TP/SL, touched —
  // not just the perp→spot Pro-type clear. No value leaks across markets.

  it('clears size/price/slippage/touched after a market switch (single hook instance)', () => {
    // Drive the identity change through a re-rendered hook whose selected-market
    // context flips symbol — the reset must fire on the symbol change.
    const venue = buildVenue(vi.fn(), { supportsStopOrders: true })
    let market: Market = DEFAULT_PERP_MARKET
    const { result, rerender } = renderHook(() => useOrderEntry(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(
          SpectateContext.Provider,
          { value: buildSpectate() },
          createElement(
            VenueContext.Provider,
            { value: withMarketContext(venue, 100, market) },
            createElement(
              SelectedMarketContext.Provider,
              { value: { selectedMarket: market.symbol, setSelectedMarket: () => {}, market } },
              createElement(
                LeverageMarginProvider,
                null,
                createElement(FakeOrderIntentProvider, { pending: null }, children),
              ),
            ),
          ),
        ),
    })
    act(() => {
      result.current.setOrderType('stop-market')
      result.current.setSizeInput('7')
      result.current.setStopPriceInput('65000')
      result.current.setSlippageInput('4')
    })
    expect(result.current.form.sizeInput).toBe('7')

    market = ONE_DP_MARKET
    rerender()
    expect(result.current.form.sizeInput).toBe(DEFAULT_SIZE)
    expect(result.current.form.stopPriceInput).toBe('')
    expect(result.current.form.slippageInput).toBe('')
    expect(result.current.form.orderType).toBe('market')
    expect(result.current.form.priceInput).toBe(DEFAULT_PRICE)
  })

  // ── L3: TP/SL derived figures recompute on leverage / amount change ───────
  // The displayed gain/loss is derived off the live position size. When the
  // trader changes leverage or the entered amount, the derived figure must
  // recompute; editing a leg must derive off the CURRENT size, not a snapshot.

  it('recomputes the stored TP leg amount reactively when the size input changes', () => {
    // Set the leg by PRICE first (size 1), THEN change size — the stored derived
    // amount (gain) must update on its own, without the user re-typing the leg.
    const venue = buildVenue(vi.fn(), { supportsTriggerOrders: true })
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate(), 100),
    })
    act(() => {
      result.current.setSizeInput('1')
      result.current.setProtectionEnabled(true)
      result.current.setProtectionLegPrice('takeProfit', '110')
    })
    const amountAtSize1 = Number(result.current.protection.takeProfit.amountInput)
    expect(amountAtSize1).toBeGreaterThan(0)
    // Change size only — no leg re-entry. $ gain = |110 - 100| × size → doubles.
    act(() => result.current.setSizeInput('2'))
    const amountAtSize2 = Number(result.current.protection.takeProfit.amountInput)
    expect(amountAtSize2).toBeCloseTo(amountAtSize1 * 2, 4)
  })

  it('recomputes the stored TP leg amount when leverage changes (live size)', () => {
    // usd-unit margin 20 at price 100: coin = margin × lev / price.
    // 5× → coin 1, 10× → coin 2. Set the leg at 5×, then the figure at 10× (a
    // fresh hook standing in for a leverage change) must scale with the size.
    function buildAmount(leverage: number): number {
      const hook = renderHook(() => useOrderEntry(), {
        wrapper: buildWrapper(
          buildVenue(vi.fn(), { supportsTriggerOrders: true, positions: [buildPosition(leverage)] }),
          buildSpectate(),
          100,
        ),
      })
      act(() => hook.result.current.setSizeUnit('usd'))
      act(() => {
        hook.result.current.setSizeInput('20')
        hook.result.current.setProtectionEnabled(true)
        hook.result.current.setProtectionLegPrice('takeProfit', '110')
      })
      return Number(hook.result.current.protection.takeProfit.amountInput)
    }
    const amountAt5 = buildAmount(5)
    const amountAt10 = buildAmount(10)
    expect(amountAt5).toBeGreaterThan(0)
    expect(amountAt10).toBeCloseTo(amountAt5 * 2, 4)
  })

  it('derives an edited leg amount off the current size, not a stale snapshot', () => {
    const venue = buildVenue(vi.fn(), { supportsTriggerOrders: true })
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate(), 100),
    })
    act(() => {
      result.current.setSizeInput('1')
      result.current.setProtectionEnabled(true)
    })
    // Change size AFTER enabling, then edit the leg — the derived price must use
    // size 2 (current), not size 1 (the size at enable time).
    act(() => result.current.setSizeInput('2'))
    act(() => result.current.setProtectionLegAmount('takeProfit', '20'))
    // usd basis: priceOffset = amount / size = 20 / 2 = 10 → price = 100 + 10 = 110.
    expect(Number(result.current.protection.takeProfit.priceInput)).toBeCloseTo(110, 4)
  })

  // ── #213: assisted-prefill from a Directional suggestion ──────────────────
  // A pending order intent (published by the suggestion sheet) prefills the
  // ticket for the active market: side, limit entry, TP/SL. The user always
  // confirms — applying a prefill never calls placeOrder; submit() still does.

  it('applies a pending intent for the active market: side + limit entry + TP/SL', () => {
    const placeOrder = vi.fn()
    const venue = buildVenue(placeOrder, { supportsTriggerOrders: true })
    const intent: OrderIntent = {
      patch: {
        symbol: 'BTC-PERP',
        side: 'sell',
        orderType: 'limit',
        priceInput: '64000',
        takeProfitPriceInput: '70000',
        stopLossPriceInput: '61000',
      },
    }
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate(), 100, DEFAULT_PERP_MARKET, intent),
    })
    expect(result.current.form.side).toBe('sell')
    expect(result.current.form.orderType).toBe('limit')
    expect(result.current.form.priceInput).toBe('64000')
    expect(result.current.protection.enabled).toBe(true)
    expect(result.current.protection.takeProfit.priceInput).toBe('70000')
    expect(result.current.protection.stopLoss.priceInput).toBe('61000')
    // No auto-execute: applying a prefill never places an order.
    expect(placeOrder).not.toHaveBeenCalled()
  })

  it('does not place an order until the user invokes submit() after a prefill', async () => {
    const placeOrder: Trader['placeOrder'] = vi.fn(() =>
      okAsync({
        kind: 'resting' as const,
        orderIdentifier: 'o1',
        symbol: 'BTC-PERP',
        timestamp: 1,
      }),
    )
    const venue = buildVenue(placeOrder)
    const intent: OrderIntent = {
      patch: { symbol: 'BTC-PERP', side: 'buy', orderType: 'limit', priceInput: '64000' },
    }
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate(), 100, DEFAULT_PERP_MARKET, intent),
    })
    expect(placeOrder).not.toHaveBeenCalled()
    act(() => result.current.setSizeInput('1'))
    await act(async () => {
      result.current.submit()
    })
    expect(placeOrder).toHaveBeenCalledTimes(1)
    expect(placeOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderType: 'limit', side: 'buy', price: 64000 }),
    )
  })

  it('ignores a pending intent bound to a different market', () => {
    const venue = buildVenue(vi.fn(), { supportsTriggerOrders: true })
    const intent: OrderIntent = {
      patch: { symbol: 'ETH-PERP', side: 'sell', orderType: 'limit', priceInput: '3000' },
    }
    const { result } = renderHook(() => useOrderEntry(), {
      // active market is BTC-PERP; the intent is for ETH-PERP.
      wrapper: buildWrapper(venue, buildSpectate(), 100, DEFAULT_PERP_MARKET, intent),
    })
    expect(result.current.form.side).toBe('buy') // initial, not the intent's 'sell'
    expect(result.current.form.priceInput).toBe('') // not the intent's '3000'
  })

  it('applies each intent once — user edits after a prefill are not reverted on re-render', () => {
    const venue = buildVenue(vi.fn(), { supportsTriggerOrders: true })
    const intent: OrderIntent = {
      patch: { symbol: 'BTC-PERP', side: 'sell', orderType: 'limit', priceInput: '64000' },
    }
    const { result, rerender } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate(), 100, DEFAULT_PERP_MARKET, intent),
    })
    expect(result.current.form.side).toBe('sell')
    act(() => result.current.setSide('buy'))
    rerender()
    expect(result.current.form.side).toBe('buy') // the same intent is not re-applied
  })

  it('still blocks submit while spectating even after a prefill', async () => {
    const placeOrder = vi.fn(() =>
      okAsync({ kind: 'resting' as const, orderIdentifier: 'o1', symbol: 'BTC-PERP', timestamp: 1 }),
    )
    const venue = buildVenue(placeOrder)
    const intent: OrderIntent = {
      patch: { symbol: 'BTC-PERP', side: 'buy', orderType: 'limit', priceInput: '64000' },
    }
    const { result } = renderHook(() => useOrderEntry(), {
      wrapper: buildWrapper(venue, buildSpectate({ isSpectating: true }), 100, DEFAULT_PERP_MARKET, intent),
    })
    act(() => result.current.setSizeInput('1'))
    await act(async () => {
      result.current.submit()
    })
    expect(placeOrder).not.toHaveBeenCalled()
  })
})
