import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SpectateContext } from '@/modules/spectate/providers/spectate-provider/spectate-provider.context'
import type { SpectateContextValue } from '@/modules/spectate'
import { useTransferTrigger } from '../use-transfer-trigger'
import { useTransferSheet } from '../../../providers/transfer-sheet-provider'
import {
  buildVenueWithTransfer,
  buildVenueWithoutTransfer,
  wrapWithTransferVenue,
} from '../../transfer-sheet/__fixtures__/fake-transfer-venue'

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

describe('useTransferTrigger', () => {
  it('is available when the venue exposes transfer and the account is segregated', () => {
    const wrapper = wrapWithTransferVenue({
      venue: buildVenueWithTransfer({ isSegregated: true }),
    })
    const { result } = renderHook(() => useTransferTrigger(), { wrapper })
    expect(result.current.isTransferAvailable).toBe(true)
  })

  it('defaults to available (segregated assumption) when no accountMode capability exists', () => {
    const wrapper = wrapWithTransferVenue({ venue: buildVenueWithTransfer() })
    const { result } = renderHook(() => useTransferTrigger(), { wrapper })
    expect(result.current.isTransferAvailable).toBe(true)
  })

  it('is unavailable when the account is not segregated (unified)', () => {
    const wrapper = wrapWithTransferVenue({
      venue: buildVenueWithTransfer({ isSegregated: false }),
    })
    const { result } = renderHook(() => useTransferTrigger(), { wrapper })
    expect(result.current.isTransferAvailable).toBe(false)
  })

  it('is unavailable when the venue has no transfer capability', () => {
    const wrapper = wrapWithTransferVenue({ venue: buildVenueWithoutTransfer() })
    const { result } = renderHook(() => useTransferTrigger(), { wrapper })
    expect(result.current.isTransferAvailable).toBe(false)
  })

  it('is unavailable while spectating, even on a segregated transfer-capable venue', () => {
    const VenueWrapper = wrapWithTransferVenue({
      venue: buildVenueWithTransfer({ isSegregated: true }),
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SpectateContext.Provider value={buildSpectate({ isSpectating: true })}>
        <VenueWrapper>{children}</VenueWrapper>
      </SpectateContext.Provider>
    )
    const { result } = renderHook(() => useTransferTrigger(), { wrapper })
    expect(result.current.isTransferAvailable).toBe(false)
  })

  it('opens the transfer sheet with the default direction (no prefill) via onClick', () => {
    const wrapper = wrapWithTransferVenue({ venue: buildVenueWithTransfer() })
    const { result } = renderHook(
      () => ({ trigger: useTransferTrigger(), sheet: useTransferSheet() }),
      { wrapper },
    )
    expect(result.current.sheet.isOpen).toBe(false)
    act(() => result.current.trigger.onClick())
    expect(result.current.sheet.isOpen).toBe(true)
    expect(result.current.sheet.prefill).toBeNull()
  })
})
