import { describe, it, expect, vi } from 'vitest'
import { okAsync } from 'neverthrow'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ApiError } from '@/modules/shared/http'
import { usePerpSuggestionSheetContent } from '../use-perp-suggestion-sheet-content'
import { useSuggestionPreviewSheet } from '../../../providers/suggestion-preview-provider'
import { useVenueOnboardingSheet } from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import { isExpired } from '../perp-suggestion-sheet.utils'
import { makeSheetWrapper } from '../__fixtures__/render-sheet'
import {
  fakeAgentBalance,
  fakeEstimateErr,
  fakeExecuteErr,
  fakeExecuteOk,
  fakeExecuteCompleted,
  fakeHistoryErr,
  fakeHistoryOk,
  fakeMarketsErr,
  fakeMarketsOk,
  makeFakeClock,
  makeFakeDeps,
} from '../__fixtures__/fake-deps'
import {
  makeEstimateResult,
  makeStoredSuggestion,
  makeTokenMarket,
} from '../__fixtures__/suggestions'
import { ALLOWED_SYMBOLS } from '../ai-agents.constants'
import { MINARA_CATALOG_SYMBOLS } from '../minara-catalog.constants'
import type {
  PerpSuggestionSheetDeps,
  UsePerpSuggestionSheetContentReturn,
} from '../perp-suggestion-sheet.types'
import type { RoutedSuggestionRequest } from '../../../api/suggestions.types'
import type { EstimateSuggestion } from '../../../api/estimate-suggestion'
import type { ExecuteSuggestion } from '../../../api/execute-suggestion'

/** Drive the sheet hook and observe the preview controller in one tree. */
function useProbe(deps: PerpSuggestionSheetDeps) {
  return {
    sheet: usePerpSuggestionSheetContent(deps),
    preview: useSuggestionPreviewSheet(),
    onboardingSheet: useVenueOnboardingSheet(),
  }
}

/**
 * Seed a valid margin (the default is now $0 → invalid, so onEstimate would
 * early-return) in its own `act` so the form re-renders valid, then run the
 * estimate. Used by every estimate-path test.
 */
function estimateWithMargin(result: {
  current: { sheet: UsePerpSuggestionSheetContentReturn }
}) {
  act(() => result.current.sheet.paramForm.setMarginUsd('1000'))
  act(() => result.current.sheet.onEstimate())
}

describe('usePerpSuggestionSheetContent — estimate gates execute', () => {
  it('starts with estimate idle and canExecute false', () => {
    const { result } = renderHook(() => useProbe(makeFakeDeps()), {
      wrapper: makeSheetWrapper(),
    })
    expect(result.current.sheet.estimate.phase).toBe('idle')
    expect(result.current.sheet.canExecute).toBe(false)
  })

  it('cannot execute before estimating — onExecute toasts and never opens the preview', () => {
    const onToast = vi.fn()
    const execute = vi.fn(fakeExecuteOk())
    const { result } = renderHook(
      () => useProbe(makeFakeDeps({ execute })),
      { wrapper: makeSheetWrapper({ onToast }) },
    )
    act(() => result.current.sheet.onExecute())
    expect(execute).not.toHaveBeenCalled()
    expect(result.current.preview.target).toBeNull()
    expect(onToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error' }),
    )
  })

  it('becomes executable only after a sufficient estimate with active delegation', async () => {
    const { result } = renderHook(
      () =>
        useProbe(
          makeFakeDeps({ delegationStatus: 'active' }),
        ),
      { wrapper: makeSheetWrapper({ accountValue: 5000 }) },
    )
    await waitFor(() => expect(result.current.sheet.delegationGate).toBe('active'))

    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.estimate.phase).toBe('ready'))
    expect(result.current.sheet.canExecute).toBe(true)
  })

  it('stays non-executable when the estimate is insufficient', async () => {
    const deps = makeFakeDeps({
      delegationStatus: 'active',
      estimate: () => okAsync(makeEstimateResult({ sufficient: false })),
    })
    const { result } = renderHook(() => useProbe(deps), {
      wrapper: makeSheetWrapper({ accountValue: 5000 }),
    })
    await waitFor(() => expect(result.current.sheet.delegationGate).toBe('active'))
    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.estimate.phase).toBe('ready'))
    expect(result.current.sheet.canExecute).toBe(false)
  })
})

describe('usePerpSuggestionSheetContent — venue-onboarding gate on execute (slice 07)', () => {
  async function readyToExecute(deps: PerpSuggestionSheetDeps, onboardingReady: boolean) {
    const harness = renderHook(() => useProbe(deps), {
      wrapper: makeSheetWrapper({ accountValue: 5000, onboardingReady }),
    })
    await waitFor(() => expect(harness.result.current.sheet.delegationGate).toBe('active'))
    estimateWithMargin(harness.result)
    await waitFor(() => expect(harness.result.current.sheet.estimate.phase).toBe('ready'))
    return harness
  }

  it('executes normally when the Selected Wallet is onboarded for the venue', async () => {
    const execute = vi.fn(fakeExecuteOk())
    const { result } = await readyToExecute(
      makeFakeDeps({ delegationStatus: 'active', execute }),
      true,
    )
    act(() => result.current.sheet.onExecute())
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
    expect(result.current.onboardingSheet.isOpen).toBe(false)
  })

  it('blocks execute and opens the onboarding sheet when the venue is NOT onboarded', async () => {
    const execute = vi.fn(fakeExecuteOk())
    const { result } = await readyToExecute(
      makeFakeDeps({ delegationStatus: 'active', execute }),
      false,
    )
    // Even with a sufficient, fresh estimate + active delegation, the venue is
    // not onboarded for the Selected Wallet — execute is gated.
    act(() => result.current.sheet.onExecute())
    await Promise.resolve()
    expect(execute).not.toHaveBeenCalled()
    expect(result.current.preview.target).toBeNull()
    // The onboarding sheet is opened in place of executing.
    expect(result.current.onboardingSheet.isOpen).toBe(true)
  })
})

describe('usePerpSuggestionSheetContent — estimate failure surfacing (slice 06)', () => {
  it('maps an estimate failure to a specific reason, not the blanket string', async () => {
    const deps = makeFakeDeps({
      estimate: fakeEstimateErr(new ApiError(500, '/api/suggestions/estimate', null)),
    })
    const { result } = renderHook(() => useProbe(deps), {
      wrapper: makeSheetWrapper({ accountValue: 5000 }),
    })
    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.estimate.phase).toBe('error'))
    const estimate = result.current.sheet.estimate
    if (estimate.phase !== 'error') throw new Error('expected error phase')
    expect(estimate.error.title).toBe('Agent unavailable')
    expect(estimate.error.detail).not.toBe('Could not price this call.')
  })

  it('surfaces every 422 issue on the estimate path and stays non-retryable', async () => {
    const body = {
      error: {
        code: 'SUGGESTION_INPUT_INVALID',
        issues: {
          symbol: '"PEPE" is not a listed market',
          leverage: 'Leverage 50x exceeds the 40x venue cap',
        },
      },
    }
    const deps = makeFakeDeps({
      estimate: fakeEstimateErr(new ApiError(422, '/api/suggestions/estimate', body)),
    })
    const { result } = renderHook(() => useProbe(deps), {
      wrapper: makeSheetWrapper({ accountValue: 5000 }),
    })
    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.estimate.phase).toBe('error'))
    const estimate = result.current.sheet.estimate
    if (estimate.phase !== 'error') throw new Error('expected error phase')
    expect(estimate.error.details).toEqual([
      '"PEPE" is not a listed market',
      'Leverage 50x exceeds the 40x venue cap',
    ])
    expect(estimate.error.retryable).toBe(false)
  })
})

describe('usePerpSuggestionSheetContent — async execute (ADR-0073)', () => {
  it('opens the preview inline on a completed dedup hit (readOnly:false)', async () => {
    const suggestion = makeStoredSuggestion({ id: 'fresh' })
    const { result } = renderHook(
      () =>
        useProbe(
          makeFakeDeps({
            delegationStatus: 'active',
            execute: fakeExecuteCompleted(suggestion),
          }),
        ),
      { wrapper: makeSheetWrapper({ accountValue: 5000 }) },
    )
    await waitFor(() => expect(result.current.sheet.delegationGate).toBe('active'))

    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.canExecute).toBe(true))

    act(() => result.current.sheet.onExecute())
    await waitFor(() => expect(result.current.preview.target).not.toBeNull())
    expect(result.current.preview.target?.suggestion).toEqual(suggestion)
    expect(result.current.preview.target?.readOnly).toBe(false)
  })

  it('switches to the pending working state on a 202 accept and stays closable', async () => {
    const { result } = renderHook(
      () =>
        useProbe(
          makeFakeDeps({
            delegationStatus: 'active',
            execute: fakeExecuteOk('sug-async'),
          }),
        ),
      { wrapper: makeSheetWrapper({ accountValue: 5000 }) },
    )
    await waitFor(() => expect(result.current.sheet.delegationGate).toBe('active'))

    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.canExecute).toBe(true))

    act(() => result.current.sheet.onExecute())
    await waitFor(() => expect(result.current.sheet.execute.phase).toBe('pending'))
    // The preview stays closed (the result will arrive via the inbox toast).
    expect(result.current.preview.target).toBeNull()
  })

  it('maps an execute failure to a toast and leaves the preview closed', async () => {
    const onToast = vi.fn()
    const { result } = renderHook(
      () =>
        useProbe(
          makeFakeDeps({
            delegationStatus: 'active',
            execute: fakeExecuteErr(new ApiError(402, '/api/suggestions', null)),
          }),
        ),
      { wrapper: makeSheetWrapper({ accountValue: 5000, onToast }) },
    )
    await waitFor(() => expect(result.current.sheet.delegationGate).toBe('active'))
    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.canExecute).toBe(true))

    act(() => result.current.sheet.onExecute())
    await waitFor(() => expect(result.current.sheet.execute.phase).toBe('error'))
    expect(result.current.preview.target).toBeNull()
    expect(onToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Insufficient Agent Balance' }),
    )
  })
})

describe('usePerpSuggestionSheetContent — delegation gate', () => {
  it('reports needs-grant when the delegation status is not active', async () => {
    const { result } = renderHook(
      () => useProbe(makeFakeDeps({ delegationStatus: 'inactive' })),
      { wrapper: makeSheetWrapper() },
    )
    await waitFor(() =>
      expect(result.current.sheet.delegationGate).toBe('needs-grant'),
    )
  })

  it('is not executable while the delegation needs a grant even with a sufficient estimate', async () => {
    const { result } = renderHook(
      () => useProbe(makeFakeDeps({ delegationStatus: 'inactive' })),
      { wrapper: makeSheetWrapper({ accountValue: 5000 }) },
    )
    await waitFor(() =>
      expect(result.current.sheet.delegationGate).toBe('needs-grant'),
    )
    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.estimate.phase).toBe('ready'))
    expect(result.current.sheet.canExecute).toBe(false)
  })

  it('onGrantAccess invokes the injected delegation-consent opener', async () => {
    const onGrantAccess = vi.fn()
    const { result } = renderHook(
      () =>
        useProbe(makeFakeDeps({ delegationStatus: 'inactive', onGrantAccess })),
      { wrapper: makeSheetWrapper() },
    )
    act(() => result.current.sheet.onGrantAccess())
    expect(onGrantAccess).toHaveBeenCalledTimes(1)
  })
})

describe('usePerpSuggestionSheetContent — history reopen', () => {
  it('reopens a still-valid row into the preview with readOnly:false', () => {
    // expiresAt far in the future relative to the real clock used by onReopen.
    const valid = makeStoredSuggestion({
      id: 'valid',
      expiresAt: '2999-01-01T00:00:00.000Z',
    })
    const { result } = renderHook(() => useProbe(makeFakeDeps()), {
      wrapper: makeSheetWrapper(),
    })
    act(() => result.current.sheet.onReopenHistory(valid))
    expect(result.current.preview.target?.suggestion).toEqual(valid)
    expect(result.current.preview.target?.readOnly).toBe(false)
    expect(result.current.preview.target?.readOnly).toBe(isExpired(valid.expiresAt))
  })

  it('reopens an expired row read-only (readOnly === isExpired(row))', () => {
    const expired = makeStoredSuggestion({
      id: 'expired',
      expiresAt: '2000-01-01T00:00:00.000Z',
    })
    const { result } = renderHook(() => useProbe(makeFakeDeps()), {
      wrapper: makeSheetWrapper(),
    })
    act(() => result.current.sheet.onReopenHistory(expired))
    expect(result.current.preview.target?.readOnly).toBe(true)
    expect(result.current.preview.target?.readOnly).toBe(isExpired(expired.expiresAt))
  })
})

describe('usePerpSuggestionSheetContent — history loading', () => {
  it('loads history when the History tab opens and exposes nowMs on ready', async () => {
    const rows = [makeStoredSuggestion({ id: 'a' }), makeStoredSuggestion({ id: 'b' })]
    const { result } = renderHook(
      () => useProbe(makeFakeDeps({ history: fakeHistoryOk(rows) })),
      { wrapper: makeSheetWrapper() },
    )
    act(() => result.current.sheet.setTab('history'))
    await waitFor(() => expect(result.current.sheet.history.phase).toBe('ready'))
    const history = result.current.sheet.history
    expect(history.phase === 'ready' && history.rows).toHaveLength(2)
    expect(history.phase === 'ready' && typeof history.nowMs).toBe('number')
  })

  it('surfaces a history error phase when the read fails', async () => {
    const { result } = renderHook(
      () => useProbe(makeFakeDeps({ history: fakeHistoryErr() })),
      { wrapper: makeSheetWrapper() },
    )
    act(() => result.current.sheet.setTab('history'))
    await waitFor(() => expect(result.current.sheet.history.phase).toBe('error'))
  })
})

describe('usePerpSuggestionSheetContent — agent selection', () => {
  it('selects an enabled agent and resets the estimate/execute lifecycle', async () => {
    const { result } = renderHook(
      () => useProbe(makeFakeDeps({ delegationStatus: 'active' })),
      { wrapper: makeSheetWrapper({ accountValue: 5000 }) },
    )
    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.estimate.phase).toBe('ready'))

    act(() => result.current.sheet.selectAgent('minara'))
    expect(result.current.sheet.selectedAgentId).toBe('minara')
    expect(result.current.sheet.estimate.phase).toBe('idle')
  })

  it('ignores selecting the disabled Native agent', () => {
    const { result } = renderHook(() => useProbe(makeFakeDeps()), {
      wrapper: makeSheetWrapper(),
    })
    act(() => result.current.sheet.selectAgent('native'))
    expect(result.current.sheet.selectedAgentId).toBe('minara')
  })
})

describe('usePerpSuggestionSheetContent — DEX selection', () => {
  it('lists both DEX options and defaults the venue to hyperliquid', () => {
    const { result } = renderHook(() => useProbe(makeFakeDeps()), {
      wrapper: makeSheetWrapper(),
    })
    expect(result.current.sheet.dexOptions.map((d) => d.id)).toEqual([
      'hyperliquid',
      'extended',
    ])
    expect(result.current.sheet.selectedVenueId).toBe('hyperliquid')
  })

  it('ignores selecting the coming-soon Extended DEX (no state change)', () => {
    const { result } = renderHook(() => useProbe(makeFakeDeps()), {
      wrapper: makeSheetWrapper(),
    })
    act(() => result.current.sheet.selectVenue('extended'))
    expect(result.current.sheet.selectedVenueId).toBe('hyperliquid')
  })

  it('keeps venueId hyperliquid when Hyperliquid is selected', () => {
    const { result } = renderHook(() => useProbe(makeFakeDeps()), {
      wrapper: makeSheetWrapper(),
    })
    act(() => result.current.sheet.selectVenue('hyperliquid'))
    expect(result.current.sheet.selectedVenueId).toBe('hyperliquid')
  })

  it('includes venueId in the estimate request params', async () => {
    let captured: RoutedSuggestionRequest | null = null
    const estimate: EstimateSuggestion = (request) => {
      captured = request
      return okAsync(makeEstimateResult())
    }
    const { result } = renderHook(
      () => useProbe(makeFakeDeps({ delegationStatus: 'active', estimate })),
      { wrapper: makeSheetWrapper({ accountValue: 5000 }) },
    )
    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.estimate.phase).toBe('ready'))
    expect(captured).not.toBeNull()
    expect(captured!.venueId).toBe('hyperliquid')
  })

  it('includes venueId in the execute request params', async () => {
    let captured: RoutedSuggestionRequest | null = null
    const execute: ExecuteSuggestion = (request) => {
      captured = request
      return okAsync({ status: 'pending', suggestionId: 'sug-1' })
    }
    const { result } = renderHook(
      () => useProbe(makeFakeDeps({ delegationStatus: 'active', execute })),
      { wrapper: makeSheetWrapper({ accountValue: 5000 }) },
    )
    await waitFor(() => expect(result.current.sheet.delegationGate).toBe('active'))
    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.canExecute).toBe(true))
    act(() => result.current.sheet.onExecute())
    await waitFor(() => expect(captured).not.toBeNull())
    expect(captured!.venueId).toBe('hyperliquid')
  })
})

describe('usePerpSuggestionSheetContent — token list (ADR-0062)', () => {
  it('offers the intersection of the Minara catalog and the allowlist', async () => {
    const markets = [
      makeTokenMarket('BTC'),
      makeTokenMarket('ETH'),
      makeTokenMarket('SOL'),
    ]
    const { result } = renderHook(
      () =>
        useProbe(makeFakeDeps({ markets: fakeMarketsOk(['BTC', 'ETH', 'SOL']) })),
      { wrapper: makeSheetWrapper({ markets }) },
    )
    // Order follows the catalog (Minara order), not the allowlist's order.
    await waitFor(() =>
      expect(result.current.sheet.paramForm.tokens.map((t) => t.symbol)).toEqual([
        'BTC',
        'ETH',
        'SOL',
      ]),
    )
  })

  it('hides a catalog symbol the allowlist excludes', async () => {
    const markets = [makeTokenMarket('BTC'), makeTokenMarket('DOGE')]
    const { result } = renderHook(
      () => useProbe(makeFakeDeps({ markets: fakeMarketsOk(['BTC']) })),
      { wrapper: makeSheetWrapper({ markets }) },
    )
    await waitFor(() =>
      expect(result.current.sheet.paramForm.tokens.map((t) => t.symbol)).toEqual([
        'BTC',
      ]),
    )
    const symbols = result.current.sheet.paramForm.tokens.map((t) => t.symbol)
    expect(symbols).not.toContain('DOGE')
  })

  it('keeps an allowlisted catalog symbol the venue does not list (AI-only superset)', async () => {
    // The non-venue catalog stays a deliberate superset (ADR-0064): the venue
    // lists only BTC, yet ETH is allowlisted + in the catalog and NOT a venue
    // market, so it shows alongside the liquid BTC.
    const markets = [makeTokenMarket('BTC')]
    const { result } = renderHook(
      () => useProbe(makeFakeDeps({ markets: fakeMarketsOk(['BTC', 'ETH']) })),
      { wrapper: makeSheetWrapper({ markets }) },
    )
    await waitFor(() =>
      expect(result.current.sheet.paramForm.tokens.map((t) => t.symbol)).toEqual([
        'BTC',
        'ETH',
      ]),
    )
  })

  it('drops a venue-listed catalog symbol below the liquidity floor (ADR-0064)', async () => {
    // The SSoT fix: a real venue market the Market Selection window hides as
    // illiquid can never appear in the AI feed. ETH is venue-listed but below the
    // floor → dropped; BTC is liquid → kept. (A non-venue symbol would survive —
    // that path is the superset test above.)
    const markets = [
      makeTokenMarket('BTC'),
      { ...makeTokenMarket('ETH'), volume24h: 1_000 },
    ]
    const { result } = renderHook(
      () => useProbe(makeFakeDeps({ markets: fakeMarketsOk(['BTC', 'ETH']) })),
      { wrapper: makeSheetWrapper({ markets }) },
    )
    await waitFor(() =>
      expect(result.current.sheet.paramForm.tokens.map((t) => t.symbol)).toEqual([
        'BTC',
      ]),
    )
    expect(
      result.current.sheet.paramForm.tokens.map((t) => t.symbol),
    ).not.toContain('ETH')
  })

  it('falls back to the full Minara catalog when the allowlist fetch fails', async () => {
    const markets = ALLOWED_SYMBOLS.map((s) => makeTokenMarket(s))
    const { result } = renderHook(
      () => useProbe(makeFakeDeps({ markets: fakeMarketsErr() })),
      { wrapper: makeSheetWrapper({ markets }) },
    )
    await waitFor(() =>
      expect(result.current.sheet.paramForm.tokens.map((t) => t.symbol)).toEqual([
        ...MINARA_CATALOG_SYMBOLS,
      ]),
    )
  })
})

describe('usePerpSuggestionSheetContent — estimate freshness + grace period (slice 07)', () => {
  it('stamps producedAt on the ready estimate from the injected clock', async () => {
    const clock = makeFakeClock(5_000_000)
    const deps = makeFakeDeps({
      delegationStatus: 'active',
      now: clock.now,
      createInterval: clock.createInterval,
    })
    const { result } = renderHook(() => useProbe(deps), {
      wrapper: makeSheetWrapper({ accountValue: 5000 }),
    })
    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.estimate.phase).toBe('ready'))
    const estimate = result.current.sheet.estimate
    if (estimate.phase !== 'ready') throw new Error('expected ready phase')
    expect(estimate.producedAt).toBe(5_000_000)
  })

  it('"updated Ns ago" marker reflects elapsed time as the ticker advances', async () => {
    const clock = makeFakeClock()
    const deps = makeFakeDeps({
      delegationStatus: 'active',
      now: clock.now,
      createInterval: clock.createInterval,
    })
    const { result } = renderHook(() => useProbe(deps), {
      wrapper: makeSheetWrapper({ accountValue: 5000 }),
    })
    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.estimate.phase).toBe('ready'))
    expect(result.current.sheet.estimateAgeLabel).toBe('updated just now')

    act(() => {
      clock.advance(3_000)
      clock.tick()
    })
    expect(result.current.sheet.estimateAgeLabel).toBe('updated 3s ago')
  })

  it('blocks execute and reports stale once older than 10s (story 17/18 guard)', async () => {
    const clock = makeFakeClock()
    const deps = makeFakeDeps({
      delegationStatus: 'active',
      now: clock.now,
      createInterval: clock.createInterval,
    })
    const { result } = renderHook(() => useProbe(deps), {
      wrapper: makeSheetWrapper({ accountValue: 5000 }),
    })
    await waitFor(() => expect(result.current.sheet.delegationGate).toBe('active'))
    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.canExecute).toBe(true))
    expect(result.current.sheet.isEstimateStale).toBe(false)

    // Advance past the 10s grace period and tick the marker.
    act(() => {
      clock.advance(10_001)
      clock.tick()
    })
    expect(result.current.sheet.isEstimateStale).toBe(true)
    expect(result.current.sheet.canExecute).toBe(false)
  })

  it('a quote exactly at the grace boundary is still fresh', async () => {
    const clock = makeFakeClock()
    const deps = makeFakeDeps({
      delegationStatus: 'active',
      now: clock.now,
      createInterval: clock.createInterval,
    })
    const { result } = renderHook(() => useProbe(deps), {
      wrapper: makeSheetWrapper({ accountValue: 5000 }),
    })
    await waitFor(() => expect(result.current.sheet.delegationGate).toBe('active'))
    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.canExecute).toBe(true))

    act(() => {
      clock.advance(10_000)
      clock.tick()
    })
    expect(result.current.sheet.isEstimateStale).toBe(false)
    expect(result.current.sheet.canExecute).toBe(true)
  })

  it('re-estimating refreshes producedAt, clears staleness, and re-enables execute', async () => {
    const clock = makeFakeClock()
    const deps = makeFakeDeps({
      delegationStatus: 'active',
      now: clock.now,
      createInterval: clock.createInterval,
    })
    const { result } = renderHook(() => useProbe(deps), {
      wrapper: makeSheetWrapper({ accountValue: 5000 }),
    })
    await waitFor(() => expect(result.current.sheet.delegationGate).toBe('active'))
    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.canExecute).toBe(true))

    act(() => {
      clock.advance(15_000)
      clock.tick()
    })
    expect(result.current.sheet.isEstimateStale).toBe(true)
    expect(result.current.sheet.canExecute).toBe(false)

    // Explicit, free re-estimate refreshes the stamp and re-enables execute.
    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.canExecute).toBe(true))
    expect(result.current.sheet.isEstimateStale).toBe(false)
    expect(result.current.sheet.estimateAgeLabel).toBe('updated just now')
  })

  it('keeps sufficiency behavior intact — insufficient is still non-executable when fresh', async () => {
    const clock = makeFakeClock()
    const deps = makeFakeDeps({
      delegationStatus: 'active',
      estimate: () => okAsync(makeEstimateResult({ sufficient: false })),
      now: clock.now,
      createInterval: clock.createInterval,
    })
    const { result } = renderHook(() => useProbe(deps), {
      wrapper: makeSheetWrapper({ accountValue: 5000 }),
    })
    await waitFor(() => expect(result.current.sheet.delegationGate).toBe('active'))
    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.estimate.phase).toBe('ready'))
    expect(result.current.sheet.isEstimateStale).toBe(false)
    expect(result.current.sheet.canExecute).toBe(false)
  })
})

describe('usePerpSuggestionSheetContent — disconnected', () => {
  it('is never executable while disconnected', () => {
    const { result } = renderHook(() => useProbe(makeFakeDeps()), {
      wrapper: makeSheetWrapper({ connected: false }),
    })
    expect(result.current.sheet.isConnected).toBe(false)
    expect(result.current.sheet.canExecute).toBe(false)
  })
})

describe('usePerpSuggestionSheetContent — persistent Agent Balance (slice 08)', () => {
  it('exposes the live reading before any estimate is run, scoped to the selected venue', () => {
    const { result } = renderHook(
      () => useProbe(makeFakeDeps({ useAgentBalance: fakeAgentBalance(42) })),
      { wrapper: makeSheetWrapper() },
    )
    expect(result.current.sheet.estimate.phase).toBe('idle')
    expect(result.current.sheet.agentBalance.display).toBe('$42.00')
    expect(result.current.sheet.agentBalance.scopedVenueId).toBe('hyperliquid')
    expect(result.current.sheet.agentBalance.showTopUp).toBe(false)
  })

  it('surfaces an explicit error (not a fake $0.00) when the live read fails with no quote', async () => {
    const deps = makeFakeDeps({
      delegationStatus: 'active',
      useAgentBalance: fakeAgentBalance(0, 'error'),
      estimate: () =>
        okAsync(makeEstimateResult({ agentBalanceUsd: '7.50', sufficient: true })),
    })
    const { result } = renderHook(() => useProbe(deps), {
      wrapper: makeSheetWrapper({ accountValue: 5000 }),
    })
    // Pre-estimate: the failed live read surfaces as an explicit error state.
    expect(result.current.sheet.agentBalance.isError).toBe(true)
    // A ready quote carries the server-priced figure and supersedes the error.
    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.estimate.phase).toBe('ready'))
    expect(result.current.sheet.agentBalance.isError).toBe(false)
    expect(result.current.sheet.agentBalance.display).toBe('$7.50')
  })

  it("estimate's agentBalanceUsd supersedes the live reading once a quote is ready", async () => {
    const deps = makeFakeDeps({
      delegationStatus: 'active',
      useAgentBalance: fakeAgentBalance(42),
      estimate: () =>
        okAsync(makeEstimateResult({ agentBalanceUsd: '7.50', sufficient: true })),
    })
    const { result } = renderHook(() => useProbe(deps), {
      wrapper: makeSheetWrapper({ accountValue: 5000 }),
    })
    // Pre-estimate: the live reading wins.
    expect(result.current.sheet.agentBalance.display).toBe('$42.00')
    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.estimate.phase).toBe('ready'))
    // Ready: the quote-time figure supersedes — never two contradictory numbers.
    expect(result.current.sheet.agentBalance.display).toBe('$7.50')
    expect(result.current.sheet.agentBalance.showTopUp).toBe(false)
  })

  it('surfaces the top-up affordance when the ready quote is insufficient', async () => {
    const deps = makeFakeDeps({
      delegationStatus: 'active',
      useAgentBalance: fakeAgentBalance(1),
      estimate: () =>
        okAsync(makeEstimateResult({ agentBalanceUsd: '0.10', sufficient: false })),
    })
    const { result } = renderHook(() => useProbe(deps), {
      wrapper: makeSheetWrapper({ accountValue: 5000 }),
    })
    expect(result.current.sheet.agentBalance.showTopUp).toBe(false)
    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.estimate.phase).toBe('ready'))
    expect(result.current.sheet.agentBalance.showTopUp).toBe(true)
    expect(result.current.sheet.agentBalance.display).toBe('$0.10')
  })

  it('re-scopes to the live reading when switching DEX resets the estimate lifecycle', async () => {
    const deps = makeFakeDeps({
      delegationStatus: 'active',
      useAgentBalance: fakeAgentBalance(42),
      estimate: () =>
        okAsync(makeEstimateResult({ agentBalanceUsd: '7.50', sufficient: true })),
    })
    const { result } = renderHook(() => useProbe(deps), {
      wrapper: makeSheetWrapper({ accountValue: 5000 }),
    })
    estimateWithMargin(result)
    await waitFor(() => expect(result.current.sheet.estimate.phase).toBe('ready'))
    expect(result.current.sheet.agentBalance.display).toBe('$7.50')

    // Switching DEX (slice 04) resets the estimate → the persistent reading wins
    // again, re-scoped to the newly selected venue.
    act(() => result.current.sheet.selectVenue('hyperliquid'))
    expect(result.current.sheet.estimate.phase).toBe('idle')
    expect(result.current.sheet.agentBalance.display).toBe('$42.00')
    expect(result.current.sheet.agentBalance.scopedVenueId).toBe('hyperliquid')
  })
})
