import { describe, it, expect, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { OrderDraft, OrderIssue, PlaceOrderRequest } from '@/modules/shared/domain'
import type { ToastPayload } from '@/modules/shared/services/toast'
import { useSuggestionPreview } from '../use-suggestion-preview'
import { makePreviewWrapper } from '../__fixtures__/render-preview'
import {
  makeFakeTrader,
  makePlaceError,
  makePlaceOrderRequest,
  makeStoredSuggestion,
} from '../__fixtures__/suggestion-preview'
import {
  useSuggestionPreviewSheet,
  type PreviewTarget,
} from '../../../providers/suggestion-preview-provider'

describe('useSuggestionPreview — seeding', () => {
  it('seeds entry / stop-loss / take-profit from the raw suggestion', () => {
    const suggestion = makeStoredSuggestion({
      rawSuggestion: { entryPrice: 60000, stopLossPrice: 58000, takeProfitPrice: 65000 },
    })
    const wrapper = makePreviewWrapper({
      trader: makeFakeTrader(),
      defaultTarget: { suggestion, readOnly: false },
    })
    const { result } = renderHook(() => useSuggestionPreview(), { wrapper })

    expect(result.current.edit.entry).toBe('60000')
    expect(result.current.edit.stopLoss).toBe('58000')
    expect(result.current.edit.takeProfit).toBe('65000')
  })

  it('seeds margin and leverage from the request params', () => {
    const suggestion = makeStoredSuggestion({ requestParams: { marginUsd: 500, leverage: 5 } })
    const wrapper = makePreviewWrapper({
      trader: makeFakeTrader(),
      defaultTarget: { suggestion, readOnly: false },
    })
    const { result } = renderHook(() => useSuggestionPreview(), { wrapper })

    expect(result.current.edit.marginUsd).toBe('500')
    expect(result.current.edit.leverage).toBe('5')
  })

  it('exposes the raw suggestion and isOpen when a target is present', () => {
    const suggestion = makeStoredSuggestion()
    const wrapper = makePreviewWrapper({
      trader: makeFakeTrader(),
      defaultTarget: { suggestion, readOnly: false },
    })
    const { result } = renderHook(() => useSuggestionPreview(), { wrapper })

    expect(result.current.isOpen).toBe(true)
    expect(result.current.suggestion).toEqual(suggestion)
    expect(result.current.raw).toEqual(suggestion.rawSuggestion)
  })

  it('is closed with empty edit state when no target is present', () => {
    const wrapper = makePreviewWrapper({ trader: makeFakeTrader(), defaultTarget: null })
    const { result } = renderHook(() => useSuggestionPreview(), { wrapper })

    expect(result.current.isOpen).toBe(false)
    expect(result.current.suggestion).toBeNull()
    expect(result.current.raw).toBeNull()
    expect(result.current.edit.entry).toBe('')
  })
})

describe('useSuggestionPreview — live re-validation', () => {
  it('re-invokes validateDraft on every edit so issues reflect live state', () => {
    // The "$5 at request, $3 now" guarantee: the venue's validateDraft is the
    // single arbiter, re-run each keystroke. Here it always reports an
    // insufficient-margin issue regardless of seeded values.
    const liveIssue: OrderIssue = { field: 'size', message: 'Only $3 available now' }
    const onValidate = vi.fn<(draft: OrderDraft) => void>()
    const trader = makeFakeTrader({ issues: [liveIssue], onValidate })
    const suggestion = makeStoredSuggestion({ requestParams: { marginUsd: 500 } })
    const wrapper = makePreviewWrapper({
      trader,
      defaultTarget: { suggestion, readOnly: false },
    })
    const { result } = renderHook(() => useSuggestionPreview(), { wrapper })

    expect(result.current.issues).toEqual([liveIssue])
    const callsBeforeEdit = onValidate.mock.calls.length

    act(() => result.current.setMarginUsd('3'))

    expect(onValidate.mock.calls.length).toBeGreaterThan(callsBeforeEdit)
    expect(result.current.issues).toEqual([liveIssue])
  })

  it('passes the edited margin into the draft handed to validateDraft', () => {
    const onValidate = vi.fn<(draft: OrderDraft) => void>()
    const trader = makeFakeTrader({ onValidate })
    const suggestion = makeStoredSuggestion()
    const wrapper = makePreviewWrapper({
      trader,
      defaultTarget: { suggestion, readOnly: false },
    })
    const { result } = renderHook(() => useSuggestionPreview(), { wrapper })

    act(() => result.current.setMarginUsd('42'))

    const lastDraft = onValidate.mock.calls.at(-1)?.[0]
    expect(lastDraft?.sizeInput).toBe('42')
  })

  it('validates the suggestion OWN market — a SOL suggestion produces a SOL draft (ADR-0057 regression)', () => {
    // The headline "market is wrong" bug: with BTC selected in the terminal, a
    // SOL suggestion must still validate against SOL. The draft now carries the
    // suggestion's symbol, so the venue keys off SOL — never the terminal.
    const onValidate = vi.fn<(draft: OrderDraft) => void>()
    const trader = makeFakeTrader({ onValidate })
    const suggestion = makeStoredSuggestion({ requestParams: { symbol: 'SOL' } })
    const wrapper = makePreviewWrapper({
      trader,
      defaultTarget: { suggestion, readOnly: false },
    })
    renderHook(() => useSuggestionPreview(), { wrapper })

    expect(onValidate.mock.calls.at(-1)?.[0].symbol).toBe('SOL')
  })

  it('maps a short suggestion to a sell-side draft', () => {
    const onValidate = vi.fn<(draft: OrderDraft) => void>()
    const trader = makeFakeTrader({ onValidate })
    const suggestion = makeStoredSuggestion({ rawSuggestion: { side: 'short' } })
    const wrapper = makePreviewWrapper({
      trader,
      defaultTarget: { suggestion, readOnly: false },
    })
    renderHook(() => useSuggestionPreview(), { wrapper })

    expect(onValidate.mock.calls.at(-1)?.[0].side).toBe('sell')
  })

  it('returns no issues when validateDraft succeeds', () => {
    const trader = makeFakeTrader()
    const suggestion = makeStoredSuggestion()
    const wrapper = makePreviewWrapper({
      trader,
      defaultTarget: { suggestion, readOnly: false },
    })
    const { result } = renderHook(() => useSuggestionPreview(), { wrapper })

    expect(result.current.issues).toEqual([])
  })
})

describe('useSuggestionPreview — canPlace', () => {
  it('is true when not read-only, trader present and validation succeeds', () => {
    const wrapper = makePreviewWrapper({
      trader: makeFakeTrader(),
      defaultTarget: { suggestion: makeStoredSuggestion(), readOnly: false },
    })
    const { result } = renderHook(() => useSuggestionPreview(), { wrapper })
    expect(result.current.canPlace).toBe(true)
  })

  it('is false when the suggestion is read-only (expired)', () => {
    const wrapper = makePreviewWrapper({
      trader: makeFakeTrader(),
      defaultTarget: { suggestion: makeStoredSuggestion(), readOnly: true },
    })
    const { result } = renderHook(() => useSuggestionPreview(), { wrapper })
    expect(result.current.canPlace).toBe(false)
  })

  it('is false when validateDraft returns issues', () => {
    const wrapper = makePreviewWrapper({
      trader: makeFakeTrader({ issues: [{ field: 'size', message: 'No margin' }] }),
      defaultTarget: { suggestion: makeStoredSuggestion(), readOnly: false },
    })
    const { result } = renderHook(() => useSuggestionPreview(), { wrapper })
    expect(result.current.canPlace).toBe(false)
  })

  it('is false when no trader capability is mounted', () => {
    const wrapper = makePreviewWrapper({
      defaultTarget: { suggestion: makeStoredSuggestion(), readOnly: false },
    })
    const { result } = renderHook(() => useSuggestionPreview(), { wrapper })
    expect(result.current.canPlace).toBe(false)
    expect(result.current.issues).toEqual([])
  })
})

describe('useSuggestionPreview — onPlace', () => {
  it('builds a PlaceOrderRequest = validateDraft ok value spread with TP/SL trigger legs', () => {
    const onPlace = vi.fn<(request: PlaceOrderRequest) => void>()
    const validatedRequest = makePlaceOrderRequest({ symbol: 'BTC', side: 'buy', size: 100 })
    const trader = makeFakeTrader({ request: validatedRequest, onPlace })
    const suggestion = makeStoredSuggestion({
      rawSuggestion: { stopLossPrice: 58000, takeProfitPrice: 65000 },
    })
    const wrapper = makePreviewWrapper({
      trader,
      defaultTarget: { suggestion, readOnly: false },
    })
    const { result } = renderHook(() => useSuggestionPreview(), { wrapper })

    act(() => result.current.onPlace())

    expect(onPlace).toHaveBeenCalledTimes(1)
    const sent = onPlace.mock.calls[0][0]
    // The validated request is spread through verbatim...
    expect(sent.symbol).toBe('BTC')
    expect(sent.size).toBe(100)
    // ...with protection legs derived from the edited TP/SL.
    expect(sent.takeProfit).toEqual({
      kind: 'take-profit',
      trigger: { type: 'price', price: 65000 },
    })
    expect(sent.stopLoss).toEqual({
      kind: 'stop-loss',
      trigger: { type: 'price', price: 58000 },
    })
  })

  it('omits a trigger leg whose price is zero or non-finite', () => {
    const onPlace = vi.fn<(request: PlaceOrderRequest) => void>()
    const trader = makeFakeTrader({ onPlace })
    const suggestion = makeStoredSuggestion()
    const wrapper = makePreviewWrapper({
      trader,
      defaultTarget: { suggestion, readOnly: false },
    })
    const { result } = renderHook(() => useSuggestionPreview(), { wrapper })

    act(() => result.current.setStopLoss('0'))
    act(() => result.current.setTakeProfit(''))
    act(() => result.current.onPlace())

    const sent = onPlace.mock.calls.at(-1)?.[0]
    expect(sent?.stopLoss).toBeUndefined()
    expect(sent?.takeProfit).toBeUndefined()
  })

  it('closes the preview and shows a success toast on placeOrder success', async () => {
    const toasts: ToastPayload[] = []
    const trader = makeFakeTrader()
    const suggestion = makeStoredSuggestion()
    const wrapper = makePreviewWrapper({
      trader,
      defaultTarget: { suggestion, readOnly: false },
      onToast: (payload) => toasts.push(payload),
    })
    const { result } = renderHook(() => useSuggestionPreview(), { wrapper })

    act(() => result.current.onPlace())

    await waitFor(() => expect(result.current.isOpen).toBe(false))
    expect(result.current.place.phase).toBe('idle')
    expect(toasts).toContainEqual(
      expect.objectContaining({ variant: 'success', title: 'Order placed' }),
    )
  })

  it('sets the place error state and shows an error toast on placeOrder failure', async () => {
    const toasts: ToastPayload[] = []
    const trader = makeFakeTrader({ placeError: makePlaceError('rejected', 'Venue said no') })
    const suggestion = makeStoredSuggestion()
    const wrapper = makePreviewWrapper({
      trader,
      defaultTarget: { suggestion, readOnly: false },
      onToast: (payload) => toasts.push(payload),
    })
    const { result } = renderHook(() => useSuggestionPreview(), { wrapper })

    act(() => result.current.onPlace())

    await waitFor(() => expect(result.current.place.phase).toBe('error'))
    expect(result.current.place).toEqual({ phase: 'error', message: 'Venue said no' })
    expect(result.current.isOpen).toBe(true)
    expect(toasts).toContainEqual(
      expect.objectContaining({ variant: 'error', title: 'Order failed', description: 'Venue said no' }),
    )
  })

  it('does not place when canPlace is false (read-only)', () => {
    const onPlace = vi.fn<(request: PlaceOrderRequest) => void>()
    const trader = makeFakeTrader({ onPlace })
    const suggestion = makeStoredSuggestion()
    const wrapper = makePreviewWrapper({
      trader,
      defaultTarget: { suggestion, readOnly: true },
    })
    const { result } = renderHook(() => useSuggestionPreview(), { wrapper })

    act(() => result.current.onPlace())

    expect(onPlace).not.toHaveBeenCalled()
  })

  it('places through placeOrder without ever calling a leverage setter', () => {
    // Leverage travels in the draft only — Place must not touch the venue
    // leverage controller. The fake trader has no leverageController and Place
    // must still succeed, proving the hook never reaches for one.
    const onPlace = vi.fn<(request: PlaceOrderRequest) => void>()
    const trader = makeFakeTrader({ onPlace })
    const suggestion = makeStoredSuggestion({ requestParams: { leverage: 20 } })
    const wrapper = makePreviewWrapper({
      trader,
      defaultTarget: { suggestion, readOnly: false },
    })
    const { result } = renderHook(() => useSuggestionPreview(), { wrapper })

    act(() => result.current.onPlace())

    expect(onPlace).toHaveBeenCalledTimes(1)
  })
})

describe('useSuggestionPreview — re-seed / close', () => {
  // The provider's `open` controller is what re-seeds the legs: a different
  // suggestion id triggers the adjust-state-during-render re-seed, while `close`
  // resets to empty. Drive it through the live provider rather than swapping
  // renderHook wrappers (which would remount the hook and lose state).
  function harness(initial: PreviewTarget) {
    const open: { current?: (t: PreviewTarget) => void } = {}
    const close: { current?: () => void } = {}
    const wrapper = makePreviewWrapper({ trader: makeFakeTrader(), defaultTarget: initial })
    const { result } = renderHook(
      () => {
        const sheet = useSuggestionPreviewSheet()
        open.current = sheet.open
        close.current = sheet.close
        return useSuggestionPreview()
      },
      { wrapper },
    )
    return { result, open, close }
  }

  it('re-seeds the legs when a different suggestion id opens', () => {
    const first = makeStoredSuggestion({ id: 'a', rawSuggestion: { entryPrice: 100 } })
    const second = makeStoredSuggestion({ id: 'b', rawSuggestion: { entryPrice: 999 } })
    const { result, open } = harness({ suggestion: first, readOnly: false })

    expect(result.current.edit.entry).toBe('100')
    act(() => result.current.setEntry('555'))
    expect(result.current.edit.entry).toBe('555')

    act(() => open.current?.({ suggestion: second, readOnly: false }))
    expect(result.current.edit.entry).toBe('999')
  })

  it('resets the edit state to empty when the preview closes', () => {
    const suggestion = makeStoredSuggestion({ rawSuggestion: { entryPrice: 100 } })
    const { result, close } = harness({ suggestion, readOnly: false })

    expect(result.current.edit.entry).toBe('100')

    act(() => close.current?.())
    expect(result.current.isOpen).toBe(false)
    expect(result.current.edit.entry).toBe('')
    expect(result.current.place.phase).toBe('idle')
  })
})
