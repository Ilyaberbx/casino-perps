import { describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { OrderIntentProvider } from '../OrderIntentProvider'
import { useOrderIntent } from '../use-order-intent'
import type { OrderIntent } from '../../../trading.types'

function wrapper({ children }: { children: ReactNode }) {
  return <OrderIntentProvider>{children}</OrderIntentProvider>
}

const INTENT: OrderIntent = {
  patch: { symbol: 'BTC-PERP', side: 'buy', orderType: 'limit', priceInput: '64000' },
  leverage: 5,
}

describe('useOrderIntent', () => {
  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useOrderIntent())).toThrow(/must be used inside/i)
  })

  it('starts with no pending intent', () => {
    const { result } = renderHook(() => useOrderIntent(), { wrapper })
    expect(result.current.pending).toBeNull()
  })

  it('exposes the published intent as pending', () => {
    const { result } = renderHook(() => useOrderIntent(), { wrapper })
    act(() => result.current.publish(INTENT))
    expect(result.current.pending).toEqual(INTENT)
  })

  it('replaces a prior pending intent on a new publish', () => {
    const { result } = renderHook(() => useOrderIntent(), { wrapper })
    act(() => result.current.publish(INTENT))
    const next: OrderIntent = {
      patch: { symbol: 'ETH-PERP', side: 'sell', orderType: 'limit', priceInput: '3000' },
    }
    act(() => result.current.publish(next))
    expect(result.current.pending).toEqual(next)
  })
})
