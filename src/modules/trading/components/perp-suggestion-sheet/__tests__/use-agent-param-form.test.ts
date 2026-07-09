import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAgentParamForm } from '../use-agent-param-form'
import {
  AGENT_MAX_LEVERAGE,
  ALLOWED_SYMBOLS,
  DEFAULT_LEVERAGE,
  DEFAULT_MARGIN_USD,
  FALLBACK_MARGIN_MAX_USD,
} from '../ai-agents.constants'

const baseOptions = {
  defaultSymbol: 'BTC',
  tokens: [],
  tokensLoading: false,
  availableCollateralUsd: 5000,
  resolveMarketMaxLeverage: () => 25,
}

describe('useAgentParamForm — seeding', () => {
  it('seeds the symbol from the sheet-owned default (ADR-0056)', () => {
    const { result } = renderHook(() =>
      useAgentParamForm({ ...baseOptions, defaultSymbol: 'ETH' }),
    )
    expect(result.current.values.symbol).toBe('ETH')
  })

  it('seeds whatever default the orchestrator resolves (no terminal read here)', () => {
    const { result } = renderHook(() =>
      useAgentParamForm({ ...baseOptions, defaultSymbol: ALLOWED_SYMBOLS[0] }),
    )
    expect(result.current.values.symbol).toBe(ALLOWED_SYMBOLS[0])
  })

  it('seeds the quiet unset default margin ($0) and minimum leverage (1x)', () => {
    const { result } = renderHook(() => useAgentParamForm(baseOptions))
    expect(result.current.values.marginUsd).toBe(String(DEFAULT_MARGIN_USD))
    expect(result.current.values.leverage).toBe(String(DEFAULT_LEVERAGE))
    expect(result.current.values.style).toBe('scalping')
  })

  it('starts with no fields touched (the pristine form is silent until edited)', () => {
    const { result } = renderHook(() => useAgentParamForm(baseOptions))
    expect(result.current.touched).toEqual({})
  })
})

describe('useAgentParamForm — caps', () => {
  it('caps margin at live perp collateral when available', () => {
    const { result } = renderHook(() =>
      useAgentParamForm({ ...baseOptions, availableCollateralUsd: 250 }),
    )
    expect(result.current.marginMax).toBe(250)
  })

  it('falls back to the fixed margin ceiling when collateral is null', () => {
    const { result } = renderHook(() =>
      useAgentParamForm({ ...baseOptions, availableCollateralUsd: null }),
    )
    expect(result.current.marginMax).toBe(FALLBACK_MARGIN_MAX_USD)
  })

  it('falls back to the fixed margin ceiling when collateral is zero', () => {
    const { result } = renderHook(() =>
      useAgentParamForm({ ...baseOptions, availableCollateralUsd: 0 }),
    )
    expect(result.current.marginMax).toBe(FALLBACK_MARGIN_MAX_USD)
  })

  it('caps leverage at the market max when below the agent max', () => {
    const { result } = renderHook(() =>
      useAgentParamForm({ ...baseOptions, resolveMarketMaxLeverage: () => 25 }),
    )
    expect(result.current.leverageMax).toBe(25)
  })

  it('caps leverage at the agent max when the market max is higher', () => {
    const { result } = renderHook(() =>
      useAgentParamForm({ ...baseOptions, resolveMarketMaxLeverage: () => 100 }),
    )
    expect(result.current.leverageMax).toBe(AGENT_MAX_LEVERAGE)
  })

  it('uses the agent max when the market max is unknown', () => {
    const { result } = renderHook(() =>
      useAgentParamForm({ ...baseOptions, resolveMarketMaxLeverage: () => undefined }),
    )
    expect(result.current.leverageMax).toBe(AGENT_MAX_LEVERAGE)
  })
})

describe('useAgentParamForm — setters and validation', () => {
  it('mutates symbol via setSymbol', () => {
    const { result } = renderHook(() => useAgentParamForm(baseOptions))
    act(() => result.current.setSymbol('SOL'))
    expect(result.current.values.symbol).toBe('SOL')
  })

  it('mutates margin/leverage/style via their setters', () => {
    const { result } = renderHook(() => useAgentParamForm(baseOptions))
    act(() => {
      result.current.setMarginUsd('200')
      result.current.setLeverage('7')
      result.current.setStyle('day-trading')
    })
    expect(result.current.values.marginUsd).toBe('200')
    expect(result.current.values.leverage).toBe('7')
    expect(result.current.values.style).toBe('day-trading')
  })

  it('recomputes issues on edit — pristine $0 margin is invalid, a valid edit clears it', () => {
    const { result } = renderHook(() =>
      useAgentParamForm({ ...baseOptions, availableCollateralUsd: 100 }),
    )
    // Seed default margin is $0 (empty), so it starts invalid (no margin entered).
    expect(result.current.isValid).toBe(false)
    expect(result.current.issues.some((i) => i.field === 'marginUsd')).toBe(true)

    act(() => result.current.setMarginUsd('50'))
    expect(result.current.issues.some((i) => i.field === 'marginUsd')).toBe(false)
  })

  it('flags leverage over the cap and clears it after a valid edit', () => {
    const { result } = renderHook(() =>
      useAgentParamForm({ ...baseOptions, resolveMarketMaxLeverage: () => 10 }),
    )
    // Seed a valid margin first (the default is now $0 → invalid) so clearing the
    // leverage issue is enough to flip the whole form valid.
    act(() => result.current.setMarginUsd('100'))
    act(() => result.current.setLeverage('40'))
    expect(result.current.issues.some((i) => i.field === 'leverage')).toBe(true)

    act(() => result.current.setLeverage('5'))
    expect(result.current.issues.some((i) => i.field === 'leverage')).toBe(false)
    expect(result.current.isValid).toBe(true)
  })

  it('toParams projects the current edited values', () => {
    const { result } = renderHook(() =>
      useAgentParamForm({ ...baseOptions, availableCollateralUsd: 5000 }),
    )
    act(() => {
      result.current.setSymbol('ETH')
      result.current.setMarginUsd('300')
      result.current.setLeverage('9')
      result.current.setStyle('swing-trading')
    })
    expect(result.current.toParams()).toEqual({
      symbol: 'ETH',
      style: 'swing-trading',
      marginUsd: 300,
      leverage: 9,
    })
  })
})
