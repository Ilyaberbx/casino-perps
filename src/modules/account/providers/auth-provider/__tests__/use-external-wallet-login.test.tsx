import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExternalWalletLogin } from '../use-external-wallet-login'

type ConnectWalletCallbacks = {
  onSuccess?: (args: { wallet: { address: string } }) => void
  onError?: (error: unknown) => void
}

type FakeWallet = { address: string; loginOrLink?: () => Promise<unknown> }

let captured: ConnectWalletCallbacks = {}
const connectWalletMock = vi.fn()
let walletsValue: FakeWallet[] = []

vi.mock('@privy-io/react-auth', () => ({
  useConnectWallet: (callbacks: ConnectWalletCallbacks) => {
    captured = callbacks
    return { connectWallet: connectWalletMock }
  },
  useWallets: () => ({ wallets: walletsValue, ready: true }),
}))

beforeEach(() => {
  captured = {}
  connectWalletMock.mockReset()
  walletsValue = []
})

describe('useExternalWalletLogin', () => {
  it('calls connectWallet() when loginWithWallet() is invoked', () => {
    const { result } = renderHook(() => useExternalWalletLogin())
    act(() => {
      void result.current.loginWithWallet()
    })
    expect(connectWalletMock).toHaveBeenCalledTimes(1)
  })

  it('resolves the promise after the matching wallet appears in useWallets() and loginOrLink succeeds', async () => {
    const loginOrLink = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(() => useExternalWalletLogin())
    let promise!: Promise<void>
    act(() => {
      promise = result.current.loginWithWallet()
    })
    act(() => {
      captured.onSuccess?.({ wallet: { address: '0xABCDEF' } })
    })
    walletsValue = [{ address: '0xabcdef', loginOrLink }]
    await act(async () => {
      rerender()
    })
    await expect(promise).resolves.toBeUndefined()
    expect(loginOrLink).toHaveBeenCalledTimes(1)
  })

  it('rejects the promise when onError fires (user cancellation)', async () => {
    const { result } = renderHook(() => useExternalWalletLogin())
    const cause = Object.assign(new Error('User rejected'), { name: 'NotAllowedError' })
    let expectation!: Promise<void>
    act(() => {
      expectation = expect(result.current.loginWithWallet()).rejects.toBe(cause) as Promise<void>
    })
    await act(async () => {
      captured.onError?.(cause)
    })
    await expectation
  })

  it('rejects the promise when wallet.loginOrLink() throws', async () => {
    const cause = new Error('signature failed')
    const loginOrLink = vi.fn().mockRejectedValue(cause)
    const { result, rerender } = renderHook(() => useExternalWalletLogin())
    let expectation!: Promise<void>
    act(() => {
      expectation = expect(result.current.loginWithWallet()).rejects.toBe(cause) as Promise<void>
    })
    act(() => {
      captured.onSuccess?.({ wallet: { address: '0x123' } })
    })
    walletsValue = [{ address: '0x123', loginOrLink }]
    await act(async () => {
      rerender()
    })
    await expectation
  })

  it('fast path: skips connectWallet and calls loginOrLink directly when a wallet is already connected', async () => {
    const loginOrLink = vi.fn().mockResolvedValue(undefined)
    walletsValue = [{ address: '0xfast', loginOrLink }]
    const { result } = renderHook(() => useExternalWalletLogin())
    await act(async () => {
      await result.current.loginWithWallet()
    })
    expect(loginOrLink).toHaveBeenCalledTimes(1)
    expect(connectWalletMock).not.toHaveBeenCalled()
  })

  it('fast path: surfaces loginOrLink rejection without calling connectWallet', async () => {
    const cause = new Error('user rejected siwe')
    const loginOrLink = vi.fn().mockRejectedValue(cause)
    walletsValue = [{ address: '0xfast', loginOrLink }]
    const { result } = renderHook(() => useExternalWalletLogin())
    await expect(result.current.loginWithWallet()).rejects.toBe(cause)
    expect(connectWalletMock).not.toHaveBeenCalled()
  })

  it('watchdog: rejects the slow-path promise when no callback fires within 60s', async () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => useExternalWalletLogin())
      let expectation!: Promise<void>
      act(() => {
        expectation = expect(result.current.loginWithWallet()).rejects.toMatchObject({
          name: 'TimeoutError',
        }) as Promise<void>
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })
      await expectation
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not call loginOrLink twice if useWallets re-renders after success', async () => {
    const loginOrLink = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(() => useExternalWalletLogin())
    let promise!: Promise<void>
    act(() => {
      promise = result.current.loginWithWallet()
    })
    act(() => {
      captured.onSuccess?.({ wallet: { address: '0xaaa' } })
    })
    walletsValue = [{ address: '0xaaa', loginOrLink }]
    await act(async () => {
      rerender()
    })
    await promise
    await act(async () => {
      rerender()
    })
    expect(loginOrLink).toHaveBeenCalledTimes(1)
  })
})
