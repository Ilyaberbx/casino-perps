import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ManageFundsProvider } from '../ManageFundsProvider'
import { useManageFunds } from '../use-manage-funds'

describe('useManageFunds', () => {
  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useManageFunds())).toThrow(/must be used inside/i)
  })

  it('starts closed on the default tab', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ManageFundsProvider>{children}</ManageFundsProvider>
    )
    const { result } = renderHook(() => useManageFunds(), { wrapper })

    expect(result.current.isOpen).toBe(false)
    expect(result.current.activeTab).toBe('deposit')
  })

  it('open(tab) sets the active tab and opens the modal', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ManageFundsProvider>{children}</ManageFundsProvider>
    )
    const { result } = renderHook(() => useManageFunds(), { wrapper })

    act(() => result.current.open('withdraw'))
    expect(result.current.isOpen).toBe(true)
    expect(result.current.activeTab).toBe('withdraw')
  })

  it('setActiveTab switches the tab without closing', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ManageFundsProvider defaultOpen>{children}</ManageFundsProvider>
    )
    const { result } = renderHook(() => useManageFunds(), { wrapper })

    act(() => result.current.setActiveTab('transfer'))
    expect(result.current.activeTab).toBe('transfer')
    expect(result.current.isOpen).toBe(true)
  })

  it('close hides the modal but retains the active tab', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ManageFundsProvider defaultOpen defaultTab="send">
        {children}
      </ManageFundsProvider>
    )
    const { result } = renderHook(() => useManageFunds(), { wrapper })

    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)
    expect(result.current.activeTab).toBe('send')
  })
})
