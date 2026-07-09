import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { TransferSheetProvider } from '../TransferSheetProvider'
import { useTransferSheet } from '../use-transfer-sheet'

describe('useTransferSheet', () => {
  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useTransferSheet())).toThrow(/must be used inside/i)
  })

  it('starts closed with no prefill and toggles via open / close', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TransferSheetProvider>{children}</TransferSheetProvider>
    )
    const { result } = renderHook(() => useTransferSheet(), { wrapper })

    expect(result.current.isOpen).toBe(false)
    expect(result.current.prefill).toBeNull()
    act(() => result.current.open())
    expect(result.current.isOpen).toBe(true)
    expect(result.current.prefill).toBeNull()
    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)
  })

  it('stores the prefill when opened with a direction hint', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TransferSheetProvider>{children}</TransferSheetProvider>
    )
    const { result } = renderHook(() => useTransferSheet(), { wrapper })

    act(() => result.current.open({ from: 'perps' }))
    expect(result.current.isOpen).toBe(true)
    expect(result.current.prefill).toEqual({ from: 'perps' })
  })

  it('clears a previous prefill when re-opened with no hint', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TransferSheetProvider>{children}</TransferSheetProvider>
    )
    const { result } = renderHook(() => useTransferSheet(), { wrapper })

    act(() => result.current.open({ from: 'perps' }))
    expect(result.current.prefill).toEqual({ from: 'perps' })
    act(() => result.current.open())
    expect(result.current.prefill).toBeNull()
  })

  it('respects defaultOpen', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TransferSheetProvider defaultOpen>{children}</TransferSheetProvider>
    )
    const { result } = renderHook(() => useTransferSheet(), { wrapper })
    expect(result.current.isOpen).toBe(true)
  })
})
