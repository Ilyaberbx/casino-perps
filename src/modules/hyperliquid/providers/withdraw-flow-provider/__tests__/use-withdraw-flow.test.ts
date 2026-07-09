import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useOwnWithdrawFlow } from '../use-withdraw-flow'
import {
  buildWithdrawDeps,
  OTHER_ADDRESS,
  WITHDRAW_ERROR,
} from '../__fixtures__/fake-withdraw-flow-deps'

const MASTER = '0x1111111111111111111111111111111111111111'

describe('useOwnWithdrawFlow — initial state', () => {
  it('starts on the form, prefilled to the master, unedited, with the withdrawable cap', () => {
    const h = buildWithdrawDeps({ withdrawableUsdc: 100 })
    const { result } = renderHook(() => useOwnWithdrawFlow(h.deps))
    expect(result.current.flow.phase).toBe('form')
    expect(result.current.flow.destination).toBe(MASTER)
    expect(result.current.flow.isDestinationEdited).toBe(false)
    expect(result.current.flow.withdrawable).toBe(100)
    expect(result.current.flow.fee).toBe(1)
    expect(result.current.flow.minWithdraw).toBe(2)
    expect(result.current.isApplicable).toBe(true)
  })

  it('isApplicable is false when no master address resolves', () => {
    const h = buildWithdrawDeps({ masterAddress: null })
    const { result } = renderHook(() => useOwnWithdrawFlow(h.deps))
    expect(result.current.isApplicable).toBe(false)
  })
})

describe('useOwnWithdrawFlow — amount validation + caps', () => {
  it('invalidates an amount below the min', () => {
    const h = buildWithdrawDeps({ withdrawableUsdc: 100 })
    const { result } = renderHook(() => useOwnWithdrawFlow(h.deps))
    act(() => result.current.flow.setAmount('1'))
    expect(result.current.flow.isAmountValid).toBe(false)
    expect(result.current.flow.amountInvalidReason).toMatch(/at least/i)
  })

  it('invalidates an amount above the withdrawable cap', () => {
    const h = buildWithdrawDeps({ withdrawableUsdc: 100 })
    const { result } = renderHook(() => useOwnWithdrawFlow(h.deps))
    act(() => result.current.flow.setAmount('150'))
    expect(result.current.flow.isAmountValid).toBe(false)
    expect(result.current.flow.amountInvalidReason).toMatch(/exceeds/i)
  })

  it('accepts a valid in-range amount and computes the net received', () => {
    const h = buildWithdrawDeps({ withdrawableUsdc: 100 })
    const { result } = renderHook(() => useOwnWithdrawFlow(h.deps))
    act(() => result.current.flow.setAmount('25'))
    expect(result.current.flow.isAmountValid).toBe(true)
    expect(result.current.flow.netReceived).toBe(24)
  })

  it('MAX fills the withdrawable cap', () => {
    const h = buildWithdrawDeps({ withdrawableUsdc: 73.5 })
    const { result } = renderHook(() => useOwnWithdrawFlow(h.deps))
    act(() => result.current.flow.setAmountToMax())
    expect(result.current.flow.amount).toBe('73.5')
    expect(result.current.flow.isAmountValid).toBe(true)
  })

  it('setPercent(50) fills half the cap', () => {
    const h = buildWithdrawDeps({ withdrawableUsdc: 100 })
    const { result } = renderHook(() => useOwnWithdrawFlow(h.deps))
    act(() => result.current.flow.setPercent(50))
    expect(result.current.flow.amount).toBe('50')
  })
})

describe('useOwnWithdrawFlow — destination + irreversible gate', () => {
  it('allows review to your own (unedited) wallet without confirming', () => {
    const h = buildWithdrawDeps({ withdrawableUsdc: 100 })
    const { result } = renderHook(() => useOwnWithdrawFlow(h.deps))
    act(() => result.current.flow.setAmount('25'))
    expect(result.current.flow.canReview).toBe(true)
    act(() => result.current.flow.review())
    expect(result.current.flow.phase).toBe('review')
  })

  it('blocks review to an edited destination until irreversible is confirmed', () => {
    const h = buildWithdrawDeps({ withdrawableUsdc: 100 })
    const { result } = renderHook(() => useOwnWithdrawFlow(h.deps))
    act(() => result.current.flow.setAmount('25'))
    act(() => result.current.flow.setDestination(OTHER_ADDRESS))
    expect(result.current.flow.isDestinationEdited).toBe(true)
    expect(result.current.flow.canReview).toBe(false)
    act(() => result.current.flow.review())
    expect(result.current.flow.phase).toBe('form')
    act(() => result.current.flow.toggleConfirmIrreversible())
    expect(result.current.flow.canReview).toBe(true)
    act(() => result.current.flow.review())
    expect(result.current.flow.phase).toBe('review')
  })

  it('blocks review with an invalid destination', () => {
    const h = buildWithdrawDeps({ withdrawableUsdc: 100 })
    const { result } = renderHook(() => useOwnWithdrawFlow(h.deps))
    act(() => result.current.flow.setAmount('25'))
    act(() => result.current.flow.setDestination('0x123'))
    act(() => result.current.flow.toggleConfirmIrreversible())
    expect(result.current.flow.isDestinationValid).toBe(false)
    expect(result.current.flow.canReview).toBe(false)
  })

  it('back returns review → form with input preserved', () => {
    const h = buildWithdrawDeps({ withdrawableUsdc: 100 })
    const { result } = renderHook(() => useOwnWithdrawFlow(h.deps))
    act(() => result.current.flow.setAmount('25'))
    act(() => result.current.flow.review())
    act(() => result.current.flow.back())
    expect(result.current.flow.phase).toBe('form')
    expect(result.current.flow.amount).toBe('25')
  })
})

describe('useOwnWithdrawFlow — submit', () => {
  it('signs the withdraw, lands on sent, toasts + calls onSuccess', async () => {
    const h = buildWithdrawDeps({ withdrawableUsdc: 100 })
    const { result } = renderHook(() => useOwnWithdrawFlow(h.deps))
    act(() => result.current.flow.setAmount('40'))
    act(() => result.current.flow.review())
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('sent'))
    expect(h.calls).toEqual([{ destination: MASTER, amount: '40' }])
    expect(h.toast.payloads).toHaveLength(1)
    expect(h.toast.payloads[0]?.variant).toBe('success')
    expect(h.successCount()).toBe(1)
  })

  it('signs to an edited destination', async () => {
    const h = buildWithdrawDeps({ withdrawableUsdc: 100 })
    const { result } = renderHook(() => useOwnWithdrawFlow(h.deps))
    act(() => result.current.flow.setAmount('30'))
    act(() => result.current.flow.setDestination(OTHER_ADDRESS))
    act(() => result.current.flow.toggleConfirmIrreversible())
    act(() => result.current.flow.review())
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('sent'))
    expect(h.calls).toEqual([{ destination: OTHER_ADDRESS, amount: '30' }])
  })

  it('blocks submit with insufficient-balance when the amount exceeds the cap', async () => {
    const h = buildWithdrawDeps({ withdrawableUsdc: 10 })
    const { result } = renderHook(() => useOwnWithdrawFlow(h.deps))
    act(() => result.current.flow.setAmount('50'))
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('error'))
    expect(result.current.flow.errorReason).toBe('insufficient-balance')
    expect(h.calls).toHaveLength(0)
  })

  it('errors with unknown when the master wallet cannot be resolved', async () => {
    const h = buildWithdrawDeps({ withdrawableUsdc: 100, masterWallet: null })
    const { result } = renderHook(() => useOwnWithdrawFlow(h.deps))
    act(() => result.current.flow.setAmount('40'))
    act(() => result.current.flow.review())
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('error'))
    expect(result.current.flow.errorReason).toBe('unknown')
    expect(h.calls).toHaveLength(0)
  })
})

describe('useOwnWithdrawFlow — gateway errors + recovery', () => {
  const cases = [
    { kind: 'wallet-rejected' as const, expected: 'wallet-rejected' },
    { kind: 'rate-limited' as const, expected: 'rate-limited' },
    { kind: 'network' as const, expected: 'network' },
    { kind: 'invalid-response' as const, expected: 'unknown' },
  ]
  for (const { kind, expected } of cases) {
    it(`maps gateway ${kind} → ${expected} and preserves the input`, async () => {
      const h = buildWithdrawDeps({ withdrawableUsdc: 100, withdrawOutcome: WITHDRAW_ERROR(kind) })
      const { result } = renderHook(() => useOwnWithdrawFlow(h.deps))
      act(() => result.current.flow.setAmount('30'))
      act(() => result.current.flow.review())
      await act(async () => {
        result.current.flow.submit()
        await Promise.resolve()
      })
      await waitFor(() => expect(result.current.flow.phase).toBe('error'))
      expect(result.current.flow.errorReason).toBe(expected)
      expect(result.current.flow.amount).toBe('30')
      expect(h.toast.payloads).toHaveLength(0)
      expect(h.successCount()).toBe(0)
    })
  }

  it('retry clears the error back to the form with input preserved', async () => {
    const h = buildWithdrawDeps({ withdrawableUsdc: 100, withdrawOutcome: WITHDRAW_ERROR('network') })
    const { result } = renderHook(() => useOwnWithdrawFlow(h.deps))
    act(() => result.current.flow.setAmount('30'))
    act(() => result.current.flow.review())
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('error'))
    act(() => result.current.flow.retry())
    expect(result.current.flow.phase).toBe('form')
    expect(result.current.flow.amount).toBe('30')
    expect(result.current.flow.errorReason).toBeNull()
  })

  it('reset returns to a fresh form prefilled to the master', async () => {
    const h = buildWithdrawDeps({ withdrawableUsdc: 100 })
    const { result } = renderHook(() => useOwnWithdrawFlow(h.deps))
    act(() => result.current.flow.setAmount('40'))
    act(() => result.current.flow.review())
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('sent'))
    act(() => result.current.flow.reset())
    expect(result.current.flow.phase).toBe('form')
    expect(result.current.flow.amount).toBe('')
    expect(result.current.flow.destination).toBe(MASTER)
  })
})
