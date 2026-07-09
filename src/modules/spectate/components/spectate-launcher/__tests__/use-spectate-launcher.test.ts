import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { parseWalletAddress, type WalletAddress } from '@/modules/shared/domain'
import { toast } from '@/modules/shared/services/toast'
import { SpectateContext } from '../../../providers/spectate-provider/spectate-provider.context'
import type {
  SpectateContextValue,
  WatchlistItem,
} from '../../../providers/spectate-provider/spectate-provider.types'
import { useSpectateLauncher } from '../use-spectate-launcher'

function asAddress(input: string): WalletAddress {
  const parsed = parseWalletAddress(input)
  if (parsed.isErr()) throw parsed.error
  return parsed.value
}

// Mixed-case hex body with a lowercase `0x` prefix — parseWalletAddress
// lowercases the body but requires the prefix to already be lowercase.
const MIXED_CASE_ADDRESS = '0xAbCdEf01234567890000000000000000000000Ff'
const NORMALIZED_ADDRESS = MIXED_CASE_ADDRESS.toLowerCase()

function buildSpectate(startSpectating: SpectateContextValue['startSpectating']): SpectateContextValue {
  return {
    spectatedAddress: null,
    isSpectating: false,
    startSpectating,
    stopSpectating: () => {},
    watchlist: [],
    addToWatchlist: () => {},
    removeFromWatchlist: () => {},
    isWatchlisted: () => false,
  }
}

function buildWrapper(spectate: SpectateContextValue) {
  return ({ children }: { children: ReactNode }) =>
    createElement(SpectateContext.Provider, { value: spectate }, children)
}

describe('useSpectateLauncher', () => {
  it('opens and closes the spectate window', () => {
    const { result } = renderHook(() => useSpectateLauncher(true), {
      wrapper: buildWrapper(buildSpectate(vi.fn())),
    })

    expect(result.current.isOpen).toBe(false)
    act(() => result.current.onOpen())
    expect(result.current.isOpen).toBe(true)
    act(() => result.current.onClose())
    expect(result.current.isOpen).toBe(false)
  })

  it('blocks opening with a "Connect wallet first" toast when no wallet is connected', () => {
    const showToast = vi.spyOn(toast, 'show')
    const { result } = renderHook(() => useSpectateLauncher(false), {
      wrapper: buildWrapper(buildSpectate(vi.fn())),
    })

    act(() => result.current.onOpen())

    expect(result.current.isOpen).toBe(false)
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'warning', title: 'Connect wallet first' }),
    )
    showToast.mockRestore()
  })

  it('starts spectating with a normalized valid address and closes the window', () => {
    const startSpectating = vi.fn()
    const { result } = renderHook(() => useSpectateLauncher(true), {
      wrapper: buildWrapper(buildSpectate(startSpectating)),
    })

    act(() => result.current.onOpen())
    act(() => result.current.onAddressChange(`  ${MIXED_CASE_ADDRESS}  `))
    act(() => result.current.onSubmit())

    expect(startSpectating).toHaveBeenCalledTimes(1)
    expect(startSpectating).toHaveBeenCalledWith(NORMALIZED_ADDRESS)
    expect(result.current.isOpen).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('rejects malformed input without starting a session', () => {
    const startSpectating = vi.fn()
    const { result } = renderHook(() => useSpectateLauncher(true), {
      wrapper: buildWrapper(buildSpectate(startSpectating)),
    })

    act(() => result.current.onOpen())
    act(() => result.current.onAddressChange('not-an-address'))
    act(() => result.current.onSubmit())

    expect(startSpectating).not.toHaveBeenCalled()
    expect(result.current.error).not.toBeNull()
    expect(result.current.isOpen).toBe(true)
  })

  it('clears the error once the address is edited again', () => {
    const { result } = renderHook(() => useSpectateLauncher(true), {
      wrapper: buildWrapper(buildSpectate(vi.fn())),
    })

    act(() => result.current.onOpen())
    act(() => result.current.onAddressChange('garbage'))
    act(() => result.current.onSubmit())
    expect(result.current.error).not.toBeNull()

    act(() => result.current.onAddressChange('0x'))
    expect(result.current.error).toBeNull()
  })
})

const WATCHED_ADDRESS = '0x1111111111111111111111111111111111111111'

function buildSpectateWithWatchlist(
  watchlist: WatchlistItem[],
  overrides: Partial<SpectateContextValue> = {},
): SpectateContextValue {
  return {
    spectatedAddress: null,
    isSpectating: false,
    startSpectating: vi.fn(),
    stopSpectating: vi.fn(),
    watchlist,
    addToWatchlist: vi.fn(),
    removeFromWatchlist: vi.fn(),
    isWatchlisted: () => false,
    ...overrides,
  }
}

describe('useSpectateLauncher — watchlist tab', () => {
  it('defaults to the enter tab and switches to watchlist', () => {
    const { result } = renderHook(() => useSpectateLauncher(true), {
      wrapper: buildWrapper(buildSpectateWithWatchlist([])),
    })
    expect(result.current.activeTab).toBe('enter')
    act(() => result.current.onSelectTab('watchlist'))
    expect(result.current.activeTab).toBe('watchlist')
  })

  it('save-to-watchlist adds the entered address and moves to the watchlist tab', () => {
    const addToWatchlist = vi.fn()
    const { result } = renderHook(() => useSpectateLauncher(true), {
      wrapper: buildWrapper(buildSpectateWithWatchlist([], { addToWatchlist })),
    })
    act(() => result.current.onAddressChange(WATCHED_ADDRESS))
    act(() => result.current.onSaveToWatchlist())
    expect(addToWatchlist).toHaveBeenCalledWith({ address: WATCHED_ADDRESS })
    expect(result.current.activeTab).toBe('watchlist')
    expect(result.current.addressInput).toBe('')
  })

  it('rejects save-to-watchlist for malformed input', () => {
    const addToWatchlist = vi.fn()
    const { result } = renderHook(() => useSpectateLauncher(true), {
      wrapper: buildWrapper(buildSpectateWithWatchlist([], { addToWatchlist })),
    })
    act(() => result.current.onAddressChange('garbage'))
    act(() => result.current.onSaveToWatchlist())
    expect(addToWatchlist).not.toHaveBeenCalled()
    expect(result.current.error).not.toBeNull()
  })

  it('exposes watchlist rows with truncated display addresses', () => {
    const { result } = renderHook(() => useSpectateLauncher(true), {
      wrapper: buildWrapper(
        buildSpectateWithWatchlist([{ address: asAddress(WATCHED_ADDRESS), label: 'Whale' }]),
      ),
    })
    expect(result.current.watchlistRows).toHaveLength(1)
    expect(result.current.watchlistRows[0].label).toBe('Whale')
    expect(result.current.watchlistRows[0].displayAddress).toContain('…')
  })

  it('spectate from a row starts spectating and closes', () => {
    const startSpectating = vi.fn()
    const { result } = renderHook(() => useSpectateLauncher(true), {
      wrapper: buildWrapper(
        buildSpectateWithWatchlist([{ address: asAddress(WATCHED_ADDRESS) }], { startSpectating }),
      ),
    })
    act(() => result.current.onOpen())
    act(() => result.current.onSpectateEntry(WATCHED_ADDRESS))
    expect(startSpectating).toHaveBeenCalledWith(WATCHED_ADDRESS)
    expect(result.current.isOpen).toBe(false)
  })

  it('remove calls removeFromWatchlist with the address', () => {
    const removeFromWatchlist = vi.fn()
    const { result } = renderHook(() => useSpectateLauncher(true), {
      wrapper: buildWrapper(
        buildSpectateWithWatchlist([{ address: asAddress(WATCHED_ADDRESS) }], {
          removeFromWatchlist,
        }),
      ),
    })
    act(() => result.current.onRemoveEntry(WATCHED_ADDRESS))
    expect(removeFromWatchlist).toHaveBeenCalledWith(WATCHED_ADDRESS)
  })

  it('edit-label flow: start editing, change draft, commit re-adds with the new label', () => {
    const addToWatchlist = vi.fn()
    const { result } = renderHook(() => useSpectateLauncher(true), {
      wrapper: buildWrapper(
        buildSpectateWithWatchlist([{ address: asAddress(WATCHED_ADDRESS), label: 'Old' }], {
          addToWatchlist,
        }),
      ),
    })
    act(() => result.current.onStartEditLabel(WATCHED_ADDRESS))
    expect(result.current.watchlistRows[0].isEditing).toBe(true)
    expect(result.current.watchlistRows[0].labelDraft).toBe('Old')
    act(() => result.current.onLabelDraftChange(WATCHED_ADDRESS, 'New'))
    act(() => result.current.onCommitLabel(WATCHED_ADDRESS))
    expect(addToWatchlist).toHaveBeenCalledWith({ address: WATCHED_ADDRESS, label: 'New' })
    expect(result.current.watchlistRows[0].isEditing).toBe(false)
  })

  it('commit with an empty label re-adds without a label', () => {
    const addToWatchlist = vi.fn()
    const { result } = renderHook(() => useSpectateLauncher(true), {
      wrapper: buildWrapper(
        buildSpectateWithWatchlist([{ address: asAddress(WATCHED_ADDRESS), label: 'Old' }], {
          addToWatchlist,
        }),
      ),
    })
    act(() => result.current.onStartEditLabel(WATCHED_ADDRESS))
    act(() => result.current.onLabelDraftChange(WATCHED_ADDRESS, '   '))
    act(() => result.current.onCommitLabel(WATCHED_ADDRESS))
    expect(addToWatchlist).toHaveBeenCalledWith({ address: WATCHED_ADDRESS })
  })
})
