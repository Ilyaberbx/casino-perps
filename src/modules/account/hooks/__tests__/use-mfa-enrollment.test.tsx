import type { ReactNode } from 'react'
import { ResultAsync, errAsync, okAsync } from 'neverthrow'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FakeToastProvider } from '@/modules/shared/providers/toast-provider/__fixtures__/fake-toast-provider'
import type { ToastPayload } from '@/modules/shared/services/toast'
import type { AuthError } from '../../domain/types'
import { useMfaEnrollment } from '../use-mfa-enrollment'

const FAILURE_DESCRIPTION = 'Custom failure copy.'

function wrap(onCapture: (payload: ToastPayload) => void) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <FakeToastProvider onCapture={onCapture}>{children}</FakeToastProvider>
  }
}

describe('useMfaEnrollment', () => {
  it('toggles isEnrolling true while the enroll is in flight and false after', async () => {
    let resolveEnroll: (() => void) | undefined
    const enroll = () =>
      ResultAsync.fromPromise(
        new Promise<void>((resolve) => {
          resolveEnroll = resolve
        }),
        (): AuthError => ({ kind: 'unknown', cause: 'unreachable' }),
      )
    const { result } = renderHook(() => useMfaEnrollment(enroll, FAILURE_DESCRIPTION), {
      wrapper: wrap(() => {}),
    })

    expect(result.current.isEnrolling).toBe(false)

    let setupPromise: Promise<void> | undefined
    act(() => {
      setupPromise = result.current.onSetup()
    })
    await waitFor(() => expect(result.current.isEnrolling).toBe(true))

    await act(async () => {
      resolveEnroll?.()
      await setupPromise
    })
    expect(result.current.isEnrolling).toBe(false)
  })

  it('toasts once with the failure title and the passed description on err', async () => {
    const onCapture = vi.fn<(payload: ToastPayload) => void>()
    const enroll = () => errAsync<void, AuthError>({ kind: 'cancelled' })
    const { result } = renderHook(() => useMfaEnrollment(enroll, FAILURE_DESCRIPTION), {
      wrapper: wrap(onCapture),
    })

    await act(async () => {
      await result.current.onSetup()
    })

    expect(onCapture).toHaveBeenCalledTimes(1)
    expect(onCapture).toHaveBeenCalledWith({
      variant: 'error',
      title: '2FA setup failed',
      description: FAILURE_DESCRIPTION,
    })
  })

  it('does not toast on ok', async () => {
    const onCapture = vi.fn<(payload: ToastPayload) => void>()
    const enroll = () => okAsync<void, AuthError>(undefined)
    const { result } = renderHook(() => useMfaEnrollment(enroll, FAILURE_DESCRIPTION), {
      wrapper: wrap(onCapture),
    })

    await act(async () => {
      await result.current.onSetup()
    })

    expect(onCapture).not.toHaveBeenCalled()
  })
})
