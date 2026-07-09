import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'
import { AuthContext, type AuthState } from '../../../providers/auth-provider/auth-provider.context'
import { ApiError, createApiClient, type HttpError } from '@/modules/shared/http'
import { FakeAppConfigProvider } from '@/modules/shared/providers/app-config-provider/__fixtures__/fake-app-config-provider'
import { HANDLE_DEBOUNCE_MS } from '../onboarding-stepper.constants'
import { useHandleStep } from '../use-handle-step'

const checkHandle = vi.fn()
const toastShow = vi.fn()

vi.mock('@/modules/shared/providers/toast-provider', () => ({
  useToast: () => ({ show: toastShow, dismiss: vi.fn(), dismissAll: vi.fn() }),
}))

vi.mock('../../../api/check-handle-available', () => ({
  checkHandleAvailable: (...args: unknown[]) => checkHandle(...args),
}))

function buildAuth(): AuthState {
  return {
    apiClient: createApiClient({ getAccessToken: async () => null }),
  } as unknown as AuthState
}

function wrap(auth: AuthState, inviteGateEnabled = false) {
  return ({ children }: { children: React.ReactNode }) => (
    <AuthContext.Provider value={auth}>
      <FakeAppConfigProvider inviteGateEnabled={inviteGateEnabled}>
        {children}
      </FakeAppConfigProvider>
    </AuthContext.Provider>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  checkHandle.mockReset().mockReturnValue(okAsync({ available: true }))
  toastShow.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

const submitHandle = () => okAsync<void, never>(undefined)

describe('useHandleStep — request dedup (Opt-H1)', () => {
  it('does not re-query the handle of the last completed check', async () => {
    const { result, rerender } = renderHook(() => useHandleStep(submitHandle), {
      wrapper: wrap(buildAuth()),
    })

    // Type "alice" → debounce → resolve: exactly one request.
    act(() => result.current.onHandleChange('alice'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HANDLE_DEBOUNCE_MS)
    })
    expect(checkHandle).toHaveBeenCalledTimes(1)

    // Re-rendering with the same handle (last completed check is "alice") must
    // NOT fire a second request — the answer is already known.
    rerender()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HANDLE_DEBOUNCE_MS)
    })
    expect(checkHandle).toHaveBeenCalledTimes(1)

    // Setting the same handle string again is likewise a no-op request.
    act(() => result.current.onHandleChange('alice'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HANDLE_DEBOUNCE_MS)
    })
    expect(checkHandle).toHaveBeenCalledTimes(1)
  })

  it('still queries a genuinely new handle', async () => {
    const { result } = renderHook(() => useHandleStep(submitHandle), {
      wrapper: wrap(buildAuth()),
    })

    act(() => result.current.onHandleChange('alice'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HANDLE_DEBOUNCE_MS)
    })
    act(() => result.current.onHandleChange('bob123'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HANDLE_DEBOUNCE_MS)
    })

    expect(checkHandle).toHaveBeenCalledTimes(2)
    const queried = checkHandle.mock.calls.map((c) => c[1])
    expect(queried).toEqual(['alice', 'bob123'])
  })
})

describe('useHandleStep — invite gate', () => {
  async function pickAvailableHandle(
    result: { current: ReturnType<typeof useHandleStep> },
  ) {
    act(() => result.current.onHandleChange('alice'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HANDLE_DEBOUNCE_MS)
    })
  }

  it('gate off: hides the field and submits with no code', async () => {
    const submit = vi.fn((): ResultAsync<void, HttpError> => okAsync(undefined))
    const { result } = renderHook(() => useHandleStep(submit), {
      wrapper: wrap(buildAuth(), false),
    })
    await pickAvailableHandle(result)
    expect(result.current.showInviteField).toBe(false)
    expect(result.current.canContinue).toBe(true)
    await act(async () => {
      await result.current.onContinue()
    })
    expect(submit).toHaveBeenCalledWith('alice', undefined)
  })

  it('gate on: requires a code, uppercases it, and submits it', async () => {
    const submit = vi.fn((): ResultAsync<void, HttpError> => okAsync(undefined))
    const { result } = renderHook(() => useHandleStep(submit), {
      wrapper: wrap(buildAuth(), true),
    })
    await pickAvailableHandle(result)
    expect(result.current.showInviteField).toBe(true)
    expect(result.current.canContinue).toBe(false)
    act(() => result.current.onInviteCodeChange('abcd2345'))
    expect(result.current.inviteCode).toBe('ABCD2345')
    expect(result.current.canContinue).toBe(true)
    await act(async () => {
      await result.current.onContinue()
    })
    expect(submit).toHaveBeenCalledWith('alice', 'ABCD2345')
  })

  it('gate on: surfaces an invite error inline, not via toast', async () => {
    const submit = vi.fn(
      (): ResultAsync<void, HttpError> =>
        errAsync(
          new ApiError(409, '/api/account/onboard', {
            error: { code: 'INVITE_CODE_ALREADY_REDEEMED', message: 'used' },
          }),
        ),
    )
    const { result } = renderHook(() => useHandleStep(submit), {
      wrapper: wrap(buildAuth(), true),
    })
    await pickAvailableHandle(result)
    act(() => result.current.onInviteCodeChange('ABCD2345'))
    await act(async () => {
      await result.current.onContinue()
    })
    expect(result.current.inviteError).toBe('Invite code already used')
    expect(toastShow).not.toHaveBeenCalled()
  })
})

describe('useHandleStep — submit error toast (honest mapping)', () => {
  async function pickAvailableHandle(
    result: { current: ReturnType<typeof useHandleStep> },
  ) {
    act(() => result.current.onHandleChange('alice'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HANDLE_DEBOUNCE_MS)
    })
  }

  it('a real HANDLE_TAKEN shows the handle-specific toast', async () => {
    const submit = vi.fn(
      (): ResultAsync<void, HttpError> =>
        errAsync(
          new ApiError(409, '/api/account/onboard', {
            error: { code: 'HANDLE_TAKEN', message: 'taken' },
          }),
        ),
    )
    const { result } = renderHook(() => useHandleStep(submit), {
      wrapper: wrap(buildAuth(), false),
    })
    await pickAvailableHandle(result)
    await act(async () => {
      await result.current.onContinue()
    })
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'error',
        title: 'Could not set handle',
        description: 'That handle may already be taken. Try another.',
      }),
    )
  })

  it('a 500 (INTERNAL) shows a generic toast, NOT "handle taken"', async () => {
    const submit = vi.fn(
      (): ResultAsync<void, HttpError> =>
        errAsync(
          new ApiError(500, '/api/account/onboard', {
            error: { code: 'INTERNAL', message: 'boom' },
          }),
        ),
    )
    const { result } = renderHook(() => useHandleStep(submit), {
      wrapper: wrap(buildAuth(), false),
    })
    await pickAvailableHandle(result)
    await act(async () => {
      await result.current.onContinue()
    })
    expect(toastShow).toHaveBeenCalledTimes(1)
    const arg = toastShow.mock.calls[0][0] as { title: string; description: string }
    expect(arg.title).toBe('Could not continue')
    expect(arg.description).not.toContain('already be taken')
  })
})
