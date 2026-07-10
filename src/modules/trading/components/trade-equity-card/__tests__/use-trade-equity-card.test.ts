import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { parseWalletAddress } from '@/modules/shared/domain'
import { useSpectate } from '@/modules/spectate'
import { useTradeEquityCard } from '../use-trade-equity-card'
import { buildEquityCardVenue, wrapEquityCardWithSpectate } from '../__fixtures__/equity-card-venue'

const SPECTATED_ADDRESS = parseWalletAddress('0x3333333333333333333333333333333333333333')
if (SPECTATED_ADDRESS.isErr()) throw SPECTATED_ADDRESS.error

function useCombined() {
  return { card: useTradeEquityCard(), spectate: useSpectate() }
}

describe('useTradeEquityCard — spectate transition', () => {
  beforeEach(() => localStorage.clear())

  it('resets to the loading state on spectate toggle instead of keeping the previous total frozen', () => {
    // Regression for the spectate-mode transition flash: `portfolio`'s
    // subscription is set up once and never re-subscribed on a spectate
    // toggle, and this fixture only ticks once on subscribe. Without an
    // explicit reset, the card would keep rendering the PREVIOUS address's
    // total equity across the toggle instead of showing a loading state while
    // the fresh tick for the new address is in flight.
    const { result } = renderHook(useCombined, {
      wrapper: wrapEquityCardWithSpectate(buildEquityCardVenue(true)),
    })

    expect(result.current.card.isLoading).toBe(false)
    expect(result.current.card.totalEquity).toBe(3.03)

    act(() => {
      result.current.spectate.startSpectating(SPECTATED_ADDRESS.value)
    })
    expect(result.current.card.isLoading).toBe(true)
    expect(result.current.card.totalEquity).toBeNull()

    // Exiting spectate mode must reset the same way, not keep showing the
    // spectated account's (never-updated) figure.
    act(() => {
      result.current.spectate.stopSpectating()
    })
    expect(result.current.card.isLoading).toBe(true)
    expect(result.current.card.totalEquity).toBeNull()
  })
})
