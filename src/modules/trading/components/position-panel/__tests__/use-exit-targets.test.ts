import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { okAsync } from 'neverthrow'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { VenueContext } from '@/modules/shared/providers/venue-provider/venue-provider.context'
import type {
  PerpPositionSnapshot,
  PositionProtection,
  PositionProtectionLegs,
  Venue,
} from '@/modules/shared/domain'
import { useExitTargets } from '../use-exit-targets'

function position(overrides: Partial<PerpPositionSnapshot> = {}): PerpPositionSnapshot {
  return {
    symbol: 'BTC-PERP',
    side: 'long',
    size: 1,
    entryPrice: 100,
    markPrice: 100,
    positionValueUsd: 100,
    unrealizedPnlUsd: 0,
    roePct: 0,
    leverage: 10,
    leverageType: 'cross',
    liquidationPrice: 91,
    marginUsedUsd: 10,
    ...overrides,
  }
}

function render(protection?: PositionProtection, onDone = vi.fn()) {
  const venue = {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      ...(protection ? { positionProtection: protection } : {}),
    },
  } as unknown as Venue
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(VenueContext.Provider, { value: venue }, children)
  return renderHook(() => useExitTargets(position(), onDone), { wrapper })
}

function fakeProtection(): PositionProtection {
  return {
    setProtection: vi.fn(() => okAsync(undefined)),
    clearProtection: vi.fn(() => okAsync(undefined)),
  }
}

describe('useExitTargets', () => {
  it('reports the venue cannot do this when the capability is absent', () => {
    const { result } = render(undefined)
    expect(result.current.isSupported).toBe(false)
  })

  it('previews ROE per leg as you type — the number a bare price hides', () => {
    const { result } = render(fakeProtection())
    act(() => result.current.setTakeProfitInput('110'))
    act(() => result.current.setStopLossInput('95'))
    // 10x long from 100: +10% price = +100% ROE; -5% price = -50% ROE.
    expect(result.current.takeProfitRoiPct).toBeCloseTo(100)
    expect(result.current.stopLossRoiPct).toBeCloseTo(-50)
  })

  it('cannot submit with nothing set', () => {
    const { result } = render(fakeProtection())
    expect(result.current.canSubmit).toBe(false)
  })

  it('blocks a stop past the liquidation price', () => {
    const { result } = render(fakeProtection())
    act(() => result.current.setStopLossInput('90')) // liquidation is 91
    expect(result.current.canSubmit).toBe(false)
    expect(result.current.issues[0].message).toMatch(/liquidated first/i)
  })

  it('sends both legs as price triggers and closes the sheet on success', async () => {
    const protection = fakeProtection()
    const onDone = vi.fn()
    const { result } = render(protection, onDone)

    act(() => result.current.setTakeProfitInput('110'))
    act(() => result.current.setStopLossInput('95'))
    expect(result.current.canSubmit).toBe(true)
    await act(async () => {
      result.current.submit()
    })

    expect(protection.setProtection).toHaveBeenCalledTimes(1)
    const [symbol, legs] = (protection.setProtection as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, PositionProtectionLegs]
    expect(symbol).toBe('BTC-PERP')
    expect(legs.takeProfit).toEqual({ kind: 'take-profit', trigger: { type: 'price', price: 110 } })
    expect(legs.stopLoss).toEqual({ kind: 'stop-loss', trigger: { type: 'price', price: 95 } })
    expect(onDone).toHaveBeenCalled()
  })

  it('sends only the leg that was filled in', () => {
    const protection = fakeProtection()
    const { result } = render(protection)

    act(() => result.current.setStopLossInput('95'))
    act(() => result.current.submit())

    const [, legs] = (protection.setProtection as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      PositionProtectionLegs,
    ]
    expect(legs.takeProfit).toBeUndefined()
    expect(legs.stopLoss).toBeDefined()
  })

  it('clears both legs through the venue', () => {
    const protection = fakeProtection()
    const { result } = render(protection)
    act(() => result.current.clear())
    expect(protection.clearProtection).toHaveBeenCalledWith('BTC-PERP')
  })
})
