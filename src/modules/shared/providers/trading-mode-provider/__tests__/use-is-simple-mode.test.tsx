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

  it('is false under the default pro mode', () => {
    const { result } = renderHook(() => useIsSimpleMode(), { wrapper })
    expect(result.current).toBe(false)
  })

  it('is true when the stored mode is simple', () => {
    localStorage.setItem(TRADING_MODE_STORAGE_KEY, 'simple')
    const { result } = renderHook(() => useIsSimpleMode(), { wrapper })
    expect(result.current).toBe(true)
  })

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useIsSimpleMode())).toThrow(
      'useTradingMode must be used inside <TradingModeProvider>',
    )
  })
})
