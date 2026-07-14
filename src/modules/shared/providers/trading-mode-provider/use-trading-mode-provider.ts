import { useState, useEffect, useCallback } from 'react'
import { Result } from 'neverthrow'
import type { TradingMode, UseTradingModeProviderReturn } from './trading-mode.types'
import { TRADING_MODE_STORAGE_KEY, DEFAULT_TRADING_MODE } from './trading-mode.constants'

function coerceError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function isTradingMode(value: string | null): value is TradingMode {
  return value === 'pro' || value === 'simple'
}

function readTradingModeFromStorage(): Result<TradingMode, Error> {
  return Result.fromThrowable(() => {
    const stored = localStorage.getItem(TRADING_MODE_STORAGE_KEY)
    return isTradingMode(stored) ? stored : DEFAULT_TRADING_MODE
  }, coerceError)()
}

function writeTradingModeToStorage(mode: TradingMode): Result<void, Error> {
  return Result.fromThrowable(() => {
    localStorage.setItem(TRADING_MODE_STORAGE_KEY, mode)
  }, coerceError)()
}

/**
 * Owns the global Trading Mode (`pro` / `simple`), hydrated once from
 * localStorage and re-persisted on every change. Mirrors `use-theme-provider`'s
 * read/write-via-`Result` pattern so a blocked/full storage never throws.
 */
export function useTradingModeProvider(defaultMode: TradingMode): UseTradingModeProviderReturn {
  const [mode, setModeState] = useState<TradingMode>(() => {
    const result = readTradingModeFromStorage()
    return result.isOk() ? result.value : defaultMode
  })

  useEffect(() => {
    writeTradingModeToStorage(mode)
  }, [mode])

  const setMode = useCallback((next: TradingMode) => {
    setModeState(next)
  }, [])

  return { mode, setMode }
}
