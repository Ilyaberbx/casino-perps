import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { okAsync, errAsync } from 'neverthrow'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { VenueContext } from '../../../../shared/providers/venue-provider/venue-provider.context'
import { SelectedMarketContext } from '../../selected-market-provider/selected-market-provider.context'
import type {
  LeverageController,
  MarginModeController,
  PerpsPositionsSnapshotReader,
  Venue,
} from '../../../../shared/domain'
import { SetLeverageError } from '../../../../shared/domain'
import { toast } from '@/modules/shared/services/toast'
import { useLeverageMarginState } from '../use-leverage-margin-state'

interface VenueOptions {
  leverageController?: LeverageController
  marginModeController?: MarginModeController
  perpsPositionsSnapshot?: PerpsPositionsSnapshotReader
}

function buildVenue(options: VenueOptions): Venue {
  // The leverage seed now reads the ACTING positions snapshot via `ownAccount`
  // (ADR-0038) so it reflects the User's own account while Spectating. Mirror
  // the snapshot into both the viewing capability and the acting group — with no
  // spectate concept in this test, acting === viewing.
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      ...options,
      // The hook only reads `ownAccount.perpsPositionsSnapshot.subscribe`; the
      // other three readers are present to satisfy the group shape but inert.
      ownAccount: options.perpsPositionsSnapshot
        ? ({
            perpsPositionsSnapshot: options.perpsPositionsSnapshot,
            portfolio: { subscribeSnapshot: () => () => {}, getHistory: () => okAsync([]) },
            balances: { subscribe: () => () => {} },
            feeSchedule: { subscribe: () => () => {} },
            accountMode: { current: () => ({ isSegregated: true }), subscribe: () => () => {} },
          } satisfies Venue['capabilities']['ownAccount'])
        : undefined,
    },
  }
}

function buildWrapper(venue: Venue, maxLeverage = 25) {
  return ({ children }: { children: ReactNode }) =>
    createElement(
      VenueContext.Provider,
      { value: venue },
      createElement(
        SelectedMarketContext.Provider,
        {
          value: {
            selectedMarket: 'BTC-PERP',
            setSelectedMarket: () => {},
            market: {
              symbol: 'BTC-PERP',
              baseAsset: 'BTC',
              quoteAsset: 'USD',
              venue: 'mock',
              tickSize: 0.5,
              stepSize: 0.001,
              marketType: 'perp' as const,
              hlCoin: 'BTC',
              maxLeverage,
            },
          },
        },
        children,
      ),
    )
}

describe('useLeverageMargin', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('is unavailable when neither controller is present', () => {
    const venue = buildVenue({})
    const { result } = renderHook(() => useLeverageMarginState(), { wrapper: buildWrapper(venue) })
    expect(result.current.isAvailable).toBe(false)
  })

  it('is available when only the leverage controller is present', () => {
    const venue = buildVenue({ leverageController: { setLeverage: () => okAsync(undefined) } })
    const { result } = renderHook(() => useLeverageMarginState(), { wrapper: buildWrapper(venue) })
    expect(result.current.isAvailable).toBe(true)
    expect(result.current.availability.hasMarginModeController).toBe(false)
  })

  it('defaults to 1x / cross with no position', () => {
    const venue = buildVenue({ leverageController: { setLeverage: () => okAsync(undefined) } })
    const { result } = renderHook(() => useLeverageMarginState(), { wrapper: buildWrapper(venue) })
    expect(result.current.leverage).toBe(1)
    expect(result.current.marginMode).toBe('cross')
  })

  it('seeds current state from the position snapshot for the selected market', () => {
    const snapshot: PerpsPositionsSnapshotReader = {
      subscribe: (onUpdate) => {
        onUpdate([
          {
            symbol: 'BTC-PERP',
            side: 'long',
            size: 1,
            entryPrice: 60_000,
            markPrice: 60_000,
            positionValueUsd: 60_000,
            unrealizedPnlUsd: 0,
            roePct: 0,
            leverage: 8,
            leverageType: 'isolated',
            liquidationPrice: null,
            marginUsedUsd: 7_500,
          },
        ])
        return () => {}
      },
    }
    const venue = buildVenue({
      leverageController: { setLeverage: () => okAsync(undefined) },
      perpsPositionsSnapshot: snapshot,
    })
    const { result } = renderHook(() => useLeverageMarginState(), { wrapper: buildWrapper(venue) })
    expect(result.current.leverage).toBe(8)
    expect(result.current.marginMode).toBe('isolated')
  })

  it('resolves the clamp ceiling from the market max leverage', () => {
    const venue = buildVenue({ leverageController: { setLeverage: () => okAsync(undefined) } })
    const { result } = renderHook(() => useLeverageMarginState(), {
      wrapper: buildWrapper(venue, 25),
    })
    expect(result.current.maxLeverage).toBe(25)
  })

  it('reflects the applied leverage and toasts on success', async () => {
    const setLeverage = vi.fn(() => okAsync(undefined))
    const showSpy = vi.spyOn(toast, 'show')
    const venue = buildVenue({ leverageController: { setLeverage } })
    const { result } = renderHook(() => useLeverageMarginState(), { wrapper: buildWrapper(venue) })
    await act(async () => result.current.applyLeverage(10))
    expect(setLeverage).toHaveBeenCalledWith('BTC-PERP', 10)
    expect(result.current.leverage).toBe(10)
    expect(showSpy).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    )
  })

  it('keeps the badge unchanged and toasts the reason on rejection', async () => {
    const setLeverage = vi.fn(() => errAsync(new SetLeverageError('rejected', 'boom')))
    const showSpy = vi.spyOn(toast, 'show')
    const venue = buildVenue({ leverageController: { setLeverage } })
    const { result } = renderHook(() => useLeverageMarginState(), { wrapper: buildWrapper(venue) })
    await act(async () => result.current.applyLeverage(10))
    expect(result.current.leverage).toBe(1)
    expect(showSpy).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error', description: 'boom' }),
    )
  })
})
