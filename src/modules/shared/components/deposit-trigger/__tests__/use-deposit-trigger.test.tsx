import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SpectateContext } from '@/modules/spectate/providers/spectate-provider/spectate-provider.context'
import type { SpectateContextValue } from '@/modules/spectate'
import { useDepositTrigger } from '../use-deposit-trigger'
import { useDepositSheet } from '../../../providers/deposit-sheet-provider'
import {
  buildVenueWithDeposit,
  buildVenueWithoutDeposit,
  wrapWithDepositVenue,
} from '../../deposit-sheet/__fixtures__/fake-deposit-venue'

function buildSpectate(overrides: Partial<SpectateContextValue> = {}): SpectateContextValue {
  return {
    spectatedAddress: null,
    isSpectating: false,
    startSpectating: () => {},
    stopSpectating: () => {},
    watchlist: [],
    addToWatchlist: () => {},
    removeFromWatchlist: () => {},
    isWatchlisted: () => false,
    ...overrides,
  }
}

describe('useDepositTrigger', () => {
  it('reports the capability present when the active venue exposes deposit', () => {
    const wrapper = wrapWithDepositVenue({ venue: buildVenueWithDeposit() })
    const { result } = renderHook(() => useDepositTrigger(), { wrapper })
    expect(result.current.canDeposit).toBe(true)
  })

  it('reports the capability absent when the active venue has no deposit', () => {
    const wrapper = wrapWithDepositVenue({ venue: buildVenueWithoutDeposit() })
    const { result } = renderHook(() => useDepositTrigger(), { wrapper })
    expect(result.current.canDeposit).toBe(false)
  })

  it('is not depositable while spectating, even with the capability present', () => {
    const VenueWrapper = wrapWithDepositVenue({ venue: buildVenueWithDeposit() })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SpectateContext.Provider value={buildSpectate({ isSpectating: true })}>
        <VenueWrapper>{children}</VenueWrapper>
      </SpectateContext.Provider>
    )
    const { result } = renderHook(() => useDepositTrigger(), { wrapper })
    expect(result.current.canDeposit).toBe(false)
  })

  it('opens the deposit sheet via onClick', () => {
    const wrapper = wrapWithDepositVenue({ venue: buildVenueWithDeposit() })
    const { result } = renderHook(
      () => ({ trigger: useDepositTrigger(), sheet: useDepositSheet() }),
      { wrapper },
    )
    expect(result.current.sheet.isOpen).toBe(false)
    act(() => result.current.trigger.onClick())
    expect(result.current.sheet.isOpen).toBe(true)
  })
})
