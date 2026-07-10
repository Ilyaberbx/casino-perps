import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { okAsync, ResultAsync } from 'neverthrow'
import type { PlaceOrderOutcome, PlaceOrderRequest, Trader } from '@/modules/shared/domain'
import { makeVenueWrapper } from '@/modules/shared/providers/venue-provider/__fixtures__/venue'
import { makeMyBetsVenue, makeMarket, makePosition } from '../../__fixtures__/venue'
import { useLiveBets } from '../use-live-bets'

const filledOutcome: PlaceOrderOutcome = {
  kind: 'filled',
  orderIdentifier: 'order-1',
  symbol: 'BTC-PERP',
  timestamp: 1_700_000_000_000,
  averagePrice: 104_000,
  filledSize: 0.5,
}

function renderLiveBets(placeOrder: Trader['placeOrder'], positions = [makePosition()]) {
  const venue = makeMyBetsVenue({ placeOrder, positions, markets: [makeMarket()] })
  return renderHook(() => useLiveBets(), { wrapper: makeVenueWrapper(venue) })
}

describe('useLiveBets', () => {
  it('projects each open position into a live bet with liquidation prose', () => {
    const placeOrder = vi.fn<Trader['placeOrder']>(() => okAsync(filledOutcome))
    const { result } = renderLiveBets(placeOrder)
    expect(result.current.liveBets).toHaveLength(1)
    expect(result.current.liveBets[0]).toMatchObject({
      ticker: 'BTC',
      direction: 'up',
      liquidationSentence: 'You lose this bet if BTC drops below $94,102',
    })
  })

  it('cashes out via a reduce-only full-size market close on the opposite side', () => {
    const placeOrder = vi.fn<Trader['placeOrder']>(() => okAsync(filledOutcome))
    const { result } = renderLiveBets(placeOrder)

    act(() => result.current.onCashOut('BTC-PERP'))

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

  it('ignores a cash-out for a symbol with no open bet', () => {
    const placeOrder = vi.fn<Trader['placeOrder']>(() => okAsync(filledOutcome))
    const { result } = renderLiveBets(placeOrder)
    act(() => result.current.onCashOut('DOGE-PERP'))
    expect(placeOrder).not.toHaveBeenCalled()
  })

  it('marks the bet as cashing out while the close is in flight, then clears it', async () => {
    let resolveClose: (outcome: PlaceOrderOutcome) => void = () => {}
    const pending = new Promise<PlaceOrderOutcome>((resolve) => {
      resolveClose = resolve
    })
    const placeOrder = vi.fn<Trader['placeOrder']>(() => ResultAsync.fromSafePromise(pending))
    const { result } = renderLiveBets(placeOrder)

    act(() => result.current.onCashOut('BTC-PERP'))
    expect(result.current.liveBets[0].isCashingOut).toBe(true)

    await act(async () => {
      resolveClose(filledOutcome)
      await pending
    })
    expect(result.current.liveBets[0].isCashingOut).toBe(false)
  })
})
