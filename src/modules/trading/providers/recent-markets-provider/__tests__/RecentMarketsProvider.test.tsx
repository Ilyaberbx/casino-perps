import type { ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { RECENT_MARKETS_STORAGE_KEY } from '../../../trading.constants'
import { RecentMarketsProvider } from '../RecentMarketsProvider'
import { useRecentMarkets } from '../use-recent-markets'
import { useRecentMarketsOptional } from '../use-recent-markets-optional'

function wrapper({ children }: { children: ReactNode }) {
  return <RecentMarketsProvider>{children}</RecentMarketsProvider>
}

function persisted(): string[] {
  const raw = localStorage.getItem(RECENT_MARKETS_STORAGE_KEY)
  return raw === null ? [] : JSON.parse(raw).symbols
}

describe('RecentMarketsProvider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts empty with nothing persisted', () => {
    const { result } = renderHook(() => useRecentMarkets(), { wrapper })
    expect(result.current.recentSymbols).toEqual([])
  })

  it('hydrates from localStorage on mount', () => {
    localStorage.setItem(
      RECENT_MARKETS_STORAGE_KEY,
      JSON.stringify({ version: 1, symbols: ['BTC', 'ETH'] }),
    )
    const { result } = renderHook(() => useRecentMarkets(), { wrapper })
    expect(result.current.recentSymbols).toEqual(['BTC', 'ETH'])
  })

  it('records a visit, most-recent-first, and persists it', () => {
    const { result } = renderHook(() => useRecentMarkets(), { wrapper })
    act(() => result.current.recordMarketVisit('BTC'))
    act(() => result.current.recordMarketVisit('ETH'))
    expect(result.current.recentSymbols).toEqual(['ETH', 'BTC'])
    expect(persisted()).toEqual(['ETH', 'BTC'])
  })

  it('promotes a re-visited market instead of duplicating it', () => {
    const { result } = renderHook(() => useRecentMarkets(), { wrapper })
    act(() => result.current.recordMarketVisit('BTC'))
    act(() => result.current.recordMarketVisit('ETH'))
    act(() => result.current.recordMarketVisit('BTC'))
    expect(result.current.recentSymbols).toEqual(['BTC', 'ETH'])
  })

  // The head-guard: the writer's effect re-fires on every venue snapshot, so
  // re-recording the current market must cost nothing.
  it('re-recording the head symbol leaves state identical', () => {
    const { result } = renderHook(() => useRecentMarkets(), { wrapper })
    act(() => result.current.recordMarketVisit('BTC'))
    const before = result.current.recentSymbols
    act(() => result.current.recordMarketVisit('BTC'))
    expect(result.current.recentSymbols).toBe(before)
  })

  it('survives a corrupt persisted value without throwing', () => {
    localStorage.setItem(RECENT_MARKETS_STORAGE_KEY, '{not json')
    const { result } = renderHook(() => useRecentMarkets(), { wrapper })
    expect(result.current.recentSymbols).toEqual([])
  })
})

describe('the consumer hooks outside the provider', () => {
  it('useRecentMarkets throws', () => {
    expect(() => renderHook(() => useRecentMarkets())).toThrow(
      /must be used within RecentMarketsProvider/,
    )
  })

  it('useRecentMarketsOptional returns null instead of throwing', () => {
    const { result } = renderHook(() => useRecentMarketsOptional())
    expect(result.current).toBeNull()
  })
})
