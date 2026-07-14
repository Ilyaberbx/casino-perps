import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { TradingModeProvider } from '../TradingModeProvider'
import { useTradingMode } from '../use-trading-mode'
import { TRADING_MODE_STORAGE_KEY } from '../trading-mode.constants'

function wrapper({ children }: { children: ReactNode }) {
  return <TradingModeProvider>{children}</TradingModeProvider>
}

describe('TradingModeProvider / useTradingMode', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to simple when nothing is stored', () => {
    const { result } = renderHook(() => useTradingMode(), { wrapper })
    expect(result.current.mode).toBe('simple')
  })

  it('hydrates the stored mode on mount', () => {
    localStorage.setItem(TRADING_MODE_STORAGE_KEY, 'pro')
    const { result } = renderHook(() => useTradingMode(), { wrapper })
    expect(result.current.mode).toBe('pro')
  })

  it('ignores an invalid stored value and falls back to the default', () => {
    localStorage.setItem(TRADING_MODE_STORAGE_KEY, 'turbo')
    const { result } = renderHook(() => useTradingMode(), { wrapper })
    expect(result.current.mode).toBe('simple')
  })

  it('setMode updates the value and persists it', () => {
    const { result } = renderHook(() => useTradingMode(), { wrapper })
    act(() => result.current.setMode('pro'))
    expect(result.current.mode).toBe('pro')
    expect(localStorage.getItem(TRADING_MODE_STORAGE_KEY)).toBe('pro')
  })

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useTradingMode())).toThrow(
      'useTradingMode must be used inside <TradingModeProvider>',
    )
  })
})
