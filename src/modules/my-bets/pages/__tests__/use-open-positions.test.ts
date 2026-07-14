import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { okAsync, ResultAsync } from 'neverthrow'
import type { PlaceOrderOutcome, PlaceOrderRequest, Trader } from '@/modules/shared/domain'
import { makeVenueWrapper } from '@/modules/shared/providers/venue-provider/__fixtures__/venue'
import { makeMyBetsVenue, makeMarket, makePosition } from '../../__fixtures__/venue'
import { useOpenPositions } from '../use-open-positions'

const filledOutcome: PlaceOrderOutcome = {
  kind: 'filled',
  orderIdentifier: 'order-1',
  symbol: 'BTC-PERP',
  timestamp: 1_700_000_000_000,
  averagePrice: 104_000,
  filledSize: 0.5,
}

function renderOpenPositions(placeOrder: Trader['placeOrder'], positions = [makePosition()]) {
  const venue = makeMyBetsVenue({ placeOrder, positions, markets: [makeMarket()] })
  return renderHook(() => useOpenPositions(), { wrapper: makeVenueWrapper(venue) })
}

describe('useOpenPositions', () => {
  it('projects each open position, exposing the liquidation price as a number', () => {
    const placeOrder = vi.fn<Trader['placeOrder']>(() => okAsync(filledOutcome))
    const { result } = renderOpenPositions(placeOrder)
    expect(result.current.openPositions).toHaveLength(1)
    expect(result.current.openPositions[0]).toMatchObject({
      ticker: 'BTC',
      side: 'long',
      liquidationPriceText: '94,102',
    })
  })

  it('closes via a reduce-only full-size market order on the opposite side', () => {
    const placeOrder = vi.fn<Trader['placeOrder']>(() => okAsync(filledOutcome))
    const { result } = renderOpenPositions(placeOrder)

    act(() => result.current.onClose('BTC-PERP'))

    expect(placeOrder).toHaveBeenCalledTimes(1)
    const request = placeOrder.mock.calls[0][0] as PlaceOrderRequest
    expect(request).toMatchObject({
      orderType: 'market',
      symbol: 'BTC-PERP',
      side: 'sell',
      size: 0.5,
      reduceOnly: true,
    })
  })

  it('ignores a close for a symbol with no open position', () => {
    const placeOrder = vi.fn<Trader['placeOrder']>(() => okAsync(filledOutcome))
    const { result } = renderOpenPositions(placeOrder)
    act(() => result.current.onClose('DOGE-PERP'))
    expect(placeOrder).not.toHaveBeenCalled()
  })

  it('marks the position as closing while the close is in flight, then clears it', async () => {
    let resolveClose: (outcome: PlaceOrderOutcome) => void = () => {}
    const pending = new Promise<PlaceOrderOutcome>((resolve) => {
      resolveClose = resolve
    })
    const placeOrder = vi.fn<Trader['placeOrder']>(() => ResultAsync.fromSafePromise(pending))
    const { result } = renderOpenPositions(placeOrder)

    act(() => result.current.onClose('BTC-PERP'))
    expect(result.current.openPositions[0].isClosing).toBe(true)

    await act(async () => {
      resolveClose(filledOutcome)
      await pending
    })
    expect(result.current.openPositions[0].isClosing).toBe(false)
  })
})
