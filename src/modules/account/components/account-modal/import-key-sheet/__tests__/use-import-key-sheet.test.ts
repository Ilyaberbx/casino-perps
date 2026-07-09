import { okAsync } from 'neverthrow'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Me } from '../../../../domain/types'

const IMPORTED = '0xbbbb000000000000000000000000000000000002'
const VALID_KEY_NO_PREFIX = 'a'.repeat(64)
const VALID_KEY_PREFIXED = `0x${'b'.repeat(64)}`

const importPrivateKeyMock = vi.fn<(hex: string) => Promise<{ address: string }>>()
const applyMeMock = vi.fn<(me: Me) => void>()
const importWalletMock = vi.fn()
const toastShow = vi.fn()

vi.mock('@/modules/shared/services/toast', () => ({
  toast: { show: (arg: unknown) => toastShow(arg) },
}))

vi.mock('../../../../providers/auth-provider', () => ({
  useAuth: () => ({ apiClient: {}, importPrivateKey: importPrivateKeyMock }),
}))

vi.mock('../../../../hooks/use-onboarding-flow', () => ({
  useOnboardingFlow: () => ({ kind: 'ready', me: { wallets: [] }, applyMe: applyMeMock }),
}))

vi.mock('../../../../api/import-wallet', () => ({
  importWallet: (...args: unknown[]) => importWalletMock(...args),
}))

import { useImportKeySheet } from '../use-import-key-sheet'

function me(): Me {
  return {
    user: { privyId: 'did:privy:abc', email: 'a@b.co', handle: 'abc', iconUrl: null },
    wallets: [{ chain: 'evm', address: IMPORTED, isSelected: false, source: 'imported' }],
  }
}

beforeEach(() => {
  importPrivateKeyMock.mockReset()
  applyMeMock.mockReset()
  importWalletMock.mockReset()
  toastShow.mockReset()
  importPrivateKeyMock.mockResolvedValue({ address: IMPORTED })
  importWalletMock.mockReturnValue(okAsync(me()))
})

describe('useImportKeySheet validation', () => {
  it('accepts a 64-hex key with and without the 0x prefix', () => {
    const { result } = renderHook(() => useImportKeySheet())
    act(() => result.current.setKeyInput(VALID_KEY_NO_PREFIX))
    expect(result.current.isValid).toBe(true)
    act(() => result.current.setKeyInput(VALID_KEY_PREFIXED))
    expect(result.current.isValid).toBe(true)
  })

  it('rejects too-short, non-hex, and empty input', () => {
    const { result } = renderHook(() => useImportKeySheet())
    act(() => result.current.setKeyInput('0x1234'))
    expect(result.current.isValid).toBe(false)
    act(() => result.current.setKeyInput('z'.repeat(64)))
    expect(result.current.isValid).toBe(false)
    act(() => result.current.setKeyInput(''))
    expect(result.current.isValid).toBe(false)
  })
})

describe('useImportKeySheet secret hygiene', () => {
  it('clears the key from state on close', () => {
    const { result } = renderHook(() => useImportKeySheet())
    act(() => result.current.open())
    act(() => result.current.setKeyInput(VALID_KEY_NO_PREFIX))
    expect(result.current.keyInput).toBe(VALID_KEY_NO_PREFIX)
    act(() => result.current.close())
    expect(result.current.keyInput).toBe('')
    expect(result.current.isOpen).toBe(false)
  })
})

describe('useImportKeySheet submit', () => {
  it('imports via Privy (0x-normalized), persists with source imported, applies Me, clears + closes', async () => {
    const { result } = renderHook(() => useImportKeySheet())
    act(() => result.current.open())
    act(() => result.current.setKeyInput(VALID_KEY_NO_PREFIX))
    act(() => result.current.onSubmit())

    await waitFor(() => expect(applyMeMock).toHaveBeenCalledTimes(1))
    expect(importPrivateKeyMock).toHaveBeenCalledWith(`0x${VALID_KEY_NO_PREFIX}`)
    expect(importWalletMock).toHaveBeenCalledWith({}, IMPORTED, 'imported')
    expect(result.current.keyInput).toBe('')
    expect(result.current.isOpen).toBe(false)
    expect(toastShow).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }))
  })
})
