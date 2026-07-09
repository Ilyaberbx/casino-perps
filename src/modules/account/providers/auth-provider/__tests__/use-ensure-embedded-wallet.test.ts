import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { User } from '@privy-io/react-auth'
import { useEnsureEmbeddedWallet } from '../use-ensure-embedded-wallet'
import { toast } from '@/modules/shared/services/toast'

const createWalletMock = vi.fn()
let capturedOnError: ((error: string) => void) | undefined

vi.mock('@privy-io/react-auth', () => ({
  useCreateWallet: (callbacks?: { onError?: (error: string) => void }) => {
    capturedOnError = callbacks?.onError
    return { createWallet: createWalletMock }
  },
  PrivyErrorCode: { EMBEDDED_WALLET_ALREADY_EXISTS: 'embedded_wallet_already_exists' },
}))

vi.mock('@/app/logger', () => {
  const child = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn(() => child) }
  return { logger: { ...child, child: vi.fn(() => child) } }
})

// The hook only reads `id`, `wallet`, and `linkedAccounts`; the cast keeps the
// fixture to those fields without reconstructing the full Privy `User`.
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'did:privy:u1',
    linkedAccounts: [{ type: 'email', address: 'a@b.com' }],
    wallet: null,
    ...overrides,
  } as unknown as User
}

const settled = { ready: true, authenticated: true, walletsReady: true }

beforeEach(() => {
  createWalletMock.mockReset()
  createWalletMock.mockResolvedValue(undefined)
  capturedOnError = undefined
})
afterEach(() => vi.restoreAllMocks())

describe('useEnsureEmbeddedWallet', () => {
  it('creates an embedded wallet when an authenticated user has none', () => {
    renderHook(() => useEnsureEmbeddedWallet({ ...settled, user: makeUser() }))
    expect(createWalletMock).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the user already has a canonical wallet', () => {
    const user = makeUser({ wallet: { address: '0xabc' } as unknown as User['wallet'] })
    renderHook(() => useEnsureEmbeddedWallet({ ...settled, user }))
    expect(createWalletMock).not.toHaveBeenCalled()
  })

  it('does nothing when the user already has an embedded linked wallet', () => {
    const user = makeUser({
      linkedAccounts: [
        { type: 'email', address: 'a@b.com' },
        { type: 'wallet', walletClientType: 'privy', address: '0xabc' },
      ] as unknown as User['linkedAccounts'],
    })
    renderHook(() => useEnsureEmbeddedWallet({ ...settled, user }))
    expect(createWalletMock).not.toHaveBeenCalled()
  })

  it('waits until Privy has settled (ready + authenticated + walletsReady)', () => {
    renderHook(() =>
      useEnsureEmbeddedWallet({ ready: true, authenticated: true, walletsReady: false, user: makeUser() }),
    )
    expect(createWalletMock).not.toHaveBeenCalled()
  })

  it('attempts creation only once per user across re-renders', () => {
    const user = makeUser()
    const { rerender } = renderHook((props) => useEnsureEmbeddedWallet(props), {
      initialProps: { ...settled, user },
    })
    rerender({ ...settled, user })
    rerender({ ...settled, user })
    expect(createWalletMock).toHaveBeenCalledTimes(1)
  })

  it('surfaces an error toast when creation fails (non-already-exists)', () => {
    const showSpy = vi.spyOn(toast, 'show').mockImplementation(() => 'id')
    renderHook(() => useEnsureEmbeddedWallet({ ...settled, user: makeUser() }))

    capturedOnError?.('some_other_error')

    const sessionToasts = showSpy.mock.calls.filter(
      ([payload]) => payload?.id === 'embedded-wallet-create-failed',
    )
    expect(sessionToasts).toHaveLength(1)
  })

  it('stays silent when the error is the benign already-exists race', () => {
    const showSpy = vi.spyOn(toast, 'show').mockImplementation(() => 'id')
    renderHook(() => useEnsureEmbeddedWallet({ ...settled, user: makeUser() }))

    capturedOnError?.('embedded_wallet_already_exists')

    const sessionToasts = showSpy.mock.calls.filter(
      ([payload]) => payload?.id === 'embedded-wallet-create-failed',
    )
    expect(sessionToasts).toHaveLength(0)
  })
})
