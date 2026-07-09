import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AgentBalanceSheetProvider } from '../AgentBalanceSheetProvider'
import { useAgentBalanceSheet } from '../use-agent-balance-sheet'

function wrapper({ children }: { children: ReactNode }) {
  return <AgentBalanceSheetProvider>{children}</AgentBalanceSheetProvider>
}

describe('useAgentBalanceSheet', () => {
  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useAgentBalanceSheet())).toThrow(
      /must be used inside/i,
    )
  })

  it('starts closed (mode null)', () => {
    const { result } = renderHook(() => useAgentBalanceSheet(), { wrapper })
    expect(result.current.mode).toBeNull()
  })

  it('opens on the deposit flow', () => {
    const { result } = renderHook(() => useAgentBalanceSheet(), { wrapper })
    act(() => result.current.openDeposit())
    expect(result.current.mode).toBe('deposit')
  })

  it('opens on the withdraw flow', () => {
    const { result } = renderHook(() => useAgentBalanceSheet(), { wrapper })
    act(() => result.current.openWithdraw())
    expect(result.current.mode).toBe('withdraw')
  })

  it('switches between flows without closing', () => {
    const { result } = renderHook(() => useAgentBalanceSheet(), { wrapper })
    act(() => result.current.openDeposit())
    act(() => result.current.openWithdraw())
    expect(result.current.mode).toBe('withdraw')
  })

  it('opens on the delegation-consent flow', () => {
    const { result } = renderHook(() => useAgentBalanceSheet(), { wrapper })
    act(() => result.current.openDelegation())
    expect(result.current.mode).toBe('delegation')
  })

  it('closes back to null', () => {
    const { result } = renderHook(() => useAgentBalanceSheet(), { wrapper })
    act(() => result.current.openWithdraw())
    act(() => result.current.close())
    expect(result.current.mode).toBeNull()
  })

  it('respects defaultMode', () => {
    function depositWrapper({ children }: { children: ReactNode }) {
      return (
        <AgentBalanceSheetProvider defaultMode="deposit">
          {children}
        </AgentBalanceSheetProvider>
      )
    }
    const { result } = renderHook(() => useAgentBalanceSheet(), {
      wrapper: depositWrapper,
    })
    expect(result.current.mode).toBe('deposit')
  })
})
