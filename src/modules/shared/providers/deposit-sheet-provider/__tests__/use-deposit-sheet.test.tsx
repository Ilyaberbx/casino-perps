import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { DepositSheetProvider } from '../DepositSheetProvider'
import { useDepositSheet } from '../use-deposit-sheet'

describe('useDepositSheet', () => {
  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useDepositSheet())).toThrow(/must be used inside/i)
  })

  it('starts closed and toggles via open / close', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DepositSheetProvider>{children}</DepositSheetProvider>
    )
    const { result } = renderHook(() => useDepositSheet(), { wrapper })

    expect(result.current.isOpen).toBe(false)
    act(() => result.current.open())
    expect(result.current.isOpen).toBe(true)
    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)
  })

  it('respects defaultOpen', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DepositSheetProvider defaultOpen>{children}</DepositSheetProvider>
    )
    const { result } = renderHook(() => useDepositSheet(), { wrapper })
    expect(result.current.isOpen).toBe(true)
  })
})
