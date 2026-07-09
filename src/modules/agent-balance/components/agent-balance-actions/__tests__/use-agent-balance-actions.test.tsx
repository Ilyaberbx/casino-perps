import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AgentBalanceSheetProvider } from '../../../providers/agent-balance-sheet'
import { useAgentBalanceSheet } from '../../../providers/agent-balance-sheet'
import { TradingModeProvider } from '@/modules/shared/providers/trading-mode-provider'
import { useAgentBalanceActions } from '../use-agent-balance-actions'

function wrapper({ children }: { children: ReactNode }) {
  return (
    <TradingModeProvider defaultMode="pro">
      <AgentBalanceSheetProvider>{children}</AgentBalanceSheetProvider>
    </TradingModeProvider>
  )
}

describe('useAgentBalanceActions', () => {
  it('openDeposit drives the sheet provider to the deposit mode', () => {
    const { result } = renderHook(
      () => ({
        actions: useAgentBalanceActions(),
        sheet: useAgentBalanceSheet(),
      }),
      { wrapper },
    )
    act(() => result.current.actions.openDeposit())
    expect(result.current.sheet.mode).toBe('deposit')
  })

  it('openWithdraw drives the sheet provider to the withdraw mode', () => {
    const { result } = renderHook(
      () => ({
        actions: useAgentBalanceActions(),
        sheet: useAgentBalanceSheet(),
      }),
      { wrapper },
    )
    act(() => result.current.actions.openWithdraw())
    expect(result.current.sheet.mode).toBe('withdraw')
  })

  it('openDelegation drives the sheet provider to the delegation mode', () => {
    const { result } = renderHook(
      () => ({
        actions: useAgentBalanceActions(),
        sheet: useAgentBalanceSheet(),
      }),
      { wrapper },
    )
    act(() => result.current.actions.openDelegation())
    expect(result.current.sheet.mode).toBe('delegation')
  })
})
