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

  it('defaults to pro when nothing is stored', () => {
    const { result } = renderHook(() => useTradingMode(), { wrapper })
    expect(result.current.mode).toBe('pro')
  })

  it('hydrates the stored mode on mount', () => {
    localStorage.setItem(TRADING_MODE_STORAGE_KEY, 'simple')
    const { result } = renderHook(() => useTradingMode(), { wrapper })
    expect(result.current.mode).toBe('simple')
  })

  it('ignores an invalid stored value and falls back to the default', () => {
    localStorage.setItem(TRADING_MODE_STORAGE_KEY, 'turbo')
    const { result } = renderHook(() => useTradingMode(), { wrapper })
    expect(result.current.mode).toBe('pro')
  })

  it('setMode updates the value and persists it', () => {
    const { result } = renderHook(() => useTradingMode(), { wrapper })
    act(() => result.current.setMode('simple'))
    expect(result.current.mode).toBe('simple')
    expect(localStorage.getItem(TRADING_MODE_STORAGE_KEY)).toBe('simple')
  })

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useTradingMode())).toThrow(
      'useTradingMode must be used inside <TradingModeProvider>',
    )
  })
})
