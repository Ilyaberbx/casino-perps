import { renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { TradingModeProvider } from '../TradingModeProvider'
import { useIsSimpleMode } from '../use-is-simple-mode'
import { TRADING_MODE_STORAGE_KEY } from '../trading-mode.constants'

function wrapper({ children }: { children: ReactNode }) {
  return <TradingModeProvider>{children}</TradingModeProvider>
}

describe('useIsSimpleMode', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('is true under the default simple mode', () => {
    const { result } = renderHook(() => useIsSimpleMode(), { wrapper })
    expect(result.current).toBe(true)
  })

  it('is false when the stored mode is pro', () => {
    localStorage.setItem(TRADING_MODE_STORAGE_KEY, 'pro')
    const { result } = renderHook(() => useIsSimpleMode(), { wrapper })
    expect(result.current).toBe(false)
  })

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useIsSimpleMode())).toThrow(
      'useTradingMode must be used inside <TradingModeProvider>',
    )
  })
})
