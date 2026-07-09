import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { SpectateContext } from '../../../providers/spectate-provider/spectate-provider.context'
import type { SpectateContextValue } from '../../../providers/spectate-provider/spectate-provider.types'
import { parseWalletAddress } from '@/modules/shared/domain'
import { useSpectateBanner } from '../use-spectate-banner'

const RAW_ADDRESS = '0x0c1500000000000000000000000000000000c660'
const SPECTATED_ADDRESS = parseWalletAddress(RAW_ADDRESS)._unsafeUnwrap()

function buildSpectate(overrides: Partial<SpectateContextValue> = {}): SpectateContextValue {
  return {
    spectatedAddress: SPECTATED_ADDRESS,
    isSpectating: true,
    startSpectating: vi.fn(),
    stopSpectating: vi.fn(),
    watchlist: [],
    addToWatchlist: vi.fn(),
    removeFromWatchlist: vi.fn(),
    isWatchlisted: vi.fn(() => false),
    ...overrides,
  }
}

function buildWrapper(spectate: SpectateContextValue) {
  return ({ children }: { children: ReactNode }) =>
    createElement(SpectateContext.Provider, { value: spectate }, children)
}

function dispatchCtrlX(): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', ctrlKey: true }))
}

describe('useSpectateBanner', () => {
  const writeText = vi.fn<(text: string) => Promise<void>>()

  beforeEach(() => {
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    window.history.replaceState(null, '', `/trade?spectate=${SPECTATED_ADDRESS}`)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exposes the truncated spectated address while spectating', () => {
    const { result } = renderHook(() => useSpectateBanner(), {
      wrapper: buildWrapper(buildSpectate()),
    })

    expect(result.current.visible).toBe(true)
    expect(result.current.truncatedAddress).toBe('0x0C15…C660')
  })

  it('is not visible when not spectating', () => {
    const { result } = renderHook(() => useSpectateBanner(), {
      wrapper: buildWrapper(buildSpectate({ isSpectating: false, spectatedAddress: null })),
    })

    expect(result.current.visible).toBe(false)
  })

  it('SHARE copies the current href including the spectate param', async () => {
    const { result } = renderHook(() => useSpectateBanner(), {
      wrapper: buildWrapper(buildSpectate()),
    })

    await act(async () => {
      await result.current.onShare()
    })

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith(window.location.href)
    expect(writeText.mock.calls[0]?.[0]).toContain(`spectate=${SPECTATED_ADDRESS}`)
  })

  it('the × control calls stopSpectating', () => {
    const stopSpectating = vi.fn()
    const { result } = renderHook(() => useSpectateBanner(), {
      wrapper: buildWrapper(buildSpectate({ stopSpectating })),
    })

    act(() => result.current.onStop())

    expect(stopSpectating).toHaveBeenCalledTimes(1)
  })

  it('Ctrl+X calls stopSpectating while spectating', () => {
    const stopSpectating = vi.fn()
    renderHook(() => useSpectateBanner(), {
      wrapper: buildWrapper(buildSpectate({ stopSpectating })),
    })

    act(() => dispatchCtrlX())

    expect(stopSpectating).toHaveBeenCalledTimes(1)
  })

  it('does not register the Ctrl+X listener when not spectating', () => {
    const stopSpectating = vi.fn()
    renderHook(() => useSpectateBanner(), {
      wrapper: buildWrapper(buildSpectate({ isSpectating: false, spectatedAddress: null, stopSpectating })),
    })

    act(() => dispatchCtrlX())

    expect(stopSpectating).not.toHaveBeenCalled()
  })

  it('is inert when no SpectateProvider is mounted', () => {
    const { result } = renderHook(() => useSpectateBanner())

    expect(result.current.visible).toBe(false)
    act(() => dispatchCtrlX())
    expect(result.current.truncatedAddress).toBe('')
  })

  it('removes the Ctrl+X listener on unmount', () => {
    const stopSpectating = vi.fn()
    const { unmount } = renderHook(() => useSpectateBanner(), {
      wrapper: buildWrapper(buildSpectate({ stopSpectating })),
    })

    unmount()
    act(() => dispatchCtrlX())

    expect(stopSpectating).not.toHaveBeenCalled()
  })
})
