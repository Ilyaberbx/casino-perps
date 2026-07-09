import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { useSelectedMarketProvider } from '../use-selected-market-provider'
import { SELECTED_MARKET_STORAGE_KEY, DEFAULT_SELECTED_MARKET } from '../selected-market-provider.constants'

function wrapper(initialEntries: string[] = ['/trade']) {
  return ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, { initialEntries }, children)
}

function useProviderAndLocation() {
  const market = useSelectedMarketProvider()
  const location = useLocation()
  return { market, location }
}

function useProviderAndNavigate() {
  const market = useSelectedMarketProvider()
  const navigate = useNavigate()
  return { market, navigate }
}

describe('useSelectedMarketProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('reads selected market from localStorage on mount', () => {
    window.localStorage.setItem(SELECTED_MARKET_STORAGE_KEY, 'ETH-PERP')
    const { result } = renderHook(() => useSelectedMarketProvider(), { wrapper: wrapper() })
    expect(result.current.selectedMarket).toBe('ETH-PERP')
  })

  it('falls back to BTC-PERP when localStorage has no stored market', () => {
    const { result } = renderHook(() => useSelectedMarketProvider(), { wrapper: wrapper() })
    expect(result.current.selectedMarket).toBe(DEFAULT_SELECTED_MARKET)
  })

  it('falls back to BTC-PERP when stored value is invalid', () => {
    window.localStorage.setItem(SELECTED_MARKET_STORAGE_KEY, 'INVALID-MARKET')
    const { result } = renderHook(() => useSelectedMarketProvider(), { wrapper: wrapper() })
    expect(result.current.selectedMarket).toBe(DEFAULT_SELECTED_MARKET)
  })

  it('falls back to BTC-PERP when localStorage read throws', () => {
    vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    const { result } = renderHook(() => useSelectedMarketProvider(), { wrapper: wrapper() })
    expect(result.current.selectedMarket).toBe(DEFAULT_SELECTED_MARKET)
  })

  it('persists new market to localStorage when market changes', () => {
    const { result } = renderHook(() => useSelectedMarketProvider(), { wrapper: wrapper() })
    act(() => {
      result.current.setSelectedMarket('SOL-PERP')
    })
    expect(window.localStorage.getItem(SELECTED_MARKET_STORAGE_KEY)).toBe('SOL-PERP')
  })

  it('updates selectedMarket state when setSelectedMarket is called', () => {
    const { result } = renderHook(() => useSelectedMarketProvider(), { wrapper: wrapper() })
    act(() => {
      result.current.setSelectedMarket('ETH-PERP')
    })
    expect(result.current.selectedMarket).toBe('ETH-PERP')
  })

  it('accepts only valid market symbols', () => {
    const { result } = renderHook(() => useSelectedMarketProvider(), { wrapper: wrapper() })
    act(() => {
      result.current.setSelectedMarket('SOL-PERP')
    })
    expect(result.current.selectedMarket).toBe('SOL-PERP')
  })

  it('hydrates from URL when ?market=hl:<symbol> is present, overriding storage', () => {
    window.localStorage.setItem(SELECTED_MARKET_STORAGE_KEY, 'BTC-PERP')
    const { result } = renderHook(() => useSelectedMarketProvider(), {
      wrapper: wrapper(['/trade?market=hl:ETH-PERP']),
    })
    expect(result.current.selectedMarket).toBe('ETH-PERP')
  })

  it('writes the new market to the URL as ?market=hl:<symbol> on selection', () => {
    const { result } = renderHook(() => useProviderAndLocation(), { wrapper: wrapper() })
    act(() => {
      result.current.market.setSelectedMarket('SOL-PERP')
    })
    const params = new URLSearchParams(result.current.location.search)
    expect(params.get('market')).toBe('hl:SOL-PERP')
  })

  it('ignores URL ?market=hl:<symbol> when the symbol is not a valid market', () => {
    window.localStorage.setItem(SELECTED_MARKET_STORAGE_KEY, 'ETH-PERP')
    const { result } = renderHook(() => useSelectedMarketProvider(), {
      wrapper: wrapper(['/trade?market=hl:NOTAMARKET']),
    })
    // Unknown coins are *not* loaded from URL: storage wins instead.
    expect(result.current.selectedMarket).toBe('ETH-PERP')
  })

  it('ignores URL ?market=<bad-format> and falls through to storage', () => {
    window.localStorage.setItem(SELECTED_MARKET_STORAGE_KEY, 'SOL-PERP')
    const { result } = renderHook(() => useSelectedMarketProvider(), {
      wrapper: wrapper(['/trade?market=garbage']),
    })
    expect(result.current.selectedMarket).toBe('SOL-PERP')
  })

  it('writes hydrated market to the URL on first render when ?market= is absent', async () => {
    window.localStorage.setItem(SELECTED_MARKET_STORAGE_KEY, 'ETH-PERP')
    const { result } = renderHook(() => useProviderAndLocation(), { wrapper: wrapper() })
    // selected state comes from storage…
    expect(result.current.market.selectedMarket).toBe('ETH-PERP')
    // …and the URL is also rewritten to reflect it.
    expect(new URLSearchParams(result.current.location.search).get('market')).toBe('hl:ETH-PERP')
  })

  it('writes the default market to the URL on first render when neither URL nor storage has one', () => {
    const { result } = renderHook(() => useProviderAndLocation(), { wrapper: wrapper() })
    expect(result.current.market.selectedMarket).toBe(DEFAULT_SELECTED_MARKET)
    expect(new URLSearchParams(result.current.location.search).get('market')).toBe(
      `hl:${DEFAULT_SELECTED_MARKET}`,
    )
  })

  it('adopts an externally-changed ?market= param while mounted', () => {
    const { result } = renderHook(() => useProviderAndNavigate(), {
      wrapper: wrapper(['/trade?market=hl:BTC-PERP']),
    })
    expect(result.current.market.selectedMarket).toBe('BTC-PERP')
    // The header hot-markets ticker navigates here while already on /trade.
    act(() => {
      result.current.navigate('/trade?market=hl:ETH-PERP')
    })
    expect(result.current.market.selectedMarket).toBe('ETH-PERP')
  })

  it('ignores an externally-changed ?market= param that is not a valid market', () => {
    const { result } = renderHook(() => useProviderAndNavigate(), {
      wrapper: wrapper(['/trade?market=hl:BTC-PERP']),
    })
    act(() => {
      result.current.navigate('/trade?market=hl:NOTAMARKET')
    })
    expect(result.current.market.selectedMarket).toBe('BTC-PERP')
  })

  // RED scaffold (plan 03-01 Task 1; turns green in plan 03-04).
  // WIRE-03/WIRE-04: the provider must additionally expose the resolved
  // `Market` for the current symbol (resolved via the venue's
  // MarketDataReader.listMarkets()/subscribeMarkets) while STILL persisting
  // only the symbol string to URL/storage. Fails today: the return shape has
  // no `market` field and nothing resolves the symbol to a Market.
  describe('WIRE-03/04: exposes a resolved Market for the current symbol (RED 03-04)', () => {
    it('exposes a resolved Market matching the selected symbol while persisting the string to storage', () => {
      window.localStorage.setItem(SELECTED_MARKET_STORAGE_KEY, 'ETH-PERP')
      const { result } = renderHook(() => useSelectedMarketProvider(), { wrapper: wrapper() })

      // String contract preserved (URL/storage round-trips the symbol).
      expect(result.current.selectedMarket).toBe('ETH-PERP')
      expect(window.localStorage.getItem(SELECTED_MARKET_STORAGE_KEY)).toBe('ETH-PERP')

      // Widened context value: a resolved Market for the current symbol.
      const resolved = (result.current as unknown as { market?: { symbol?: string } }).market
      expect(resolved).toBeDefined()
      expect(resolved?.symbol).toBe('ETH-PERP')
    })
  })
})
