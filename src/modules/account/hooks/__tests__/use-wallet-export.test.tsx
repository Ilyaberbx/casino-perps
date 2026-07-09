import { ResultAsync, errAsync, okAsync } from 'neverthrow'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { AuthError } from '../../domain/types'

const ADDRESS = '0xaaaa000000000000000000000000000000000001'

const hasMfaMock = vi.fn<() => boolean>()
const enrollMfaMock = vi.fn<() => ResultAsync<void, AuthError>>()
const exportWalletMock = vi.fn<(address: string) => Promise<void>>()
const toastShow = vi.fn()

vi.mock('@/modules/shared/services/toast', () => ({
  toast: { show: (arg: unknown) => toastShow(arg) },
}))

vi.mock('../../providers/auth-provider', () => ({
  useAuth: () => ({
    hasMfa: hasMfaMock(),
    enrollMfa: enrollMfaMock,
    exportWallet: exportWalletMock,
  }),
}))

import { useWalletExport } from '../use-wallet-export'

beforeEach(() => {
  hasMfaMock.mockReset()
  enrollMfaMock.mockReset()
  exportWalletMock.mockReset()
  toastShow.mockReset()
  exportWalletMock.mockResolvedValue(undefined)
})

describe('useWalletExport', () => {
  it('with no MFA: enrols first, then exports', async () => {
    hasMfaMock.mockReturnValue(false)
    enrollMfaMock.mockReturnValue(okAsync(undefined))
    const { result } = renderHook(() => useWalletExport())

    await act(async () => {
      await result.current.onExport(ADDRESS)
    })

    expect(enrollMfaMock).toHaveBeenCalledTimes(1)
    expect(exportWalletMock).toHaveBeenCalledWith(ADDRESS)
  })

  it('with MFA already enrolled: exports without enrolling', async () => {
    hasMfaMock.mockReturnValue(true)
    const { result } = renderHook(() => useWalletExport())

    await act(async () => {
      await result.current.onExport(ADDRESS)
    })

    expect(enrollMfaMock).not.toHaveBeenCalled()
    expect(exportWalletMock).toHaveBeenCalledWith(ADDRESS)
  })

  it('aborts export and toasts when MFA enrolment fails/declines', async () => {
    hasMfaMock.mockReturnValue(false)
    enrollMfaMock.mockReturnValue(errAsync<void, AuthError>({ kind: 'cancelled' }))
    const { result } = renderHook(() => useWalletExport())

    await act(async () => {
      await result.current.onExport(ADDRESS)
    })

    expect(exportWalletMock).not.toHaveBeenCalled()
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error', title: 'Enable 2FA to export' }),
    )
  })
})
