import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useOwnTransferFlow } from '../use-transfer-flow'
import { buildTransferDeps, TRANSFER_ERROR } from '../__fixtures__/fake-transfer-flow-deps'

describe('useOwnTransferFlow — initial state + direction', () => {
  it('starts idle, Spot→Perp, with the spot available balance', () => {
    const h = buildTransferDeps({ spotAvailable: 100, perpsAvailable: 50 })
    const { result } = renderHook(() => useOwnTransferFlow(h.deps))
    expect(result.current.flow.phase).toBe('idle')
    expect(result.current.flow.from).toBe('spot')
    expect(result.current.flow.to).toBe('perps')
    expect(result.current.flow.available).toBe(100)
    expect(result.current.isApplicable).toBe(true)
  })

  it('seeds the direction from the prefill (Perp→Spot) and shows the perps available', () => {
    const h = buildTransferDeps({ spotAvailable: 100, perpsAvailable: 50, prefill: { from: 'perps' } })
    const { result } = renderHook(() => useOwnTransferFlow(h.deps))
    expect(result.current.flow.from).toBe('perps')
    expect(result.current.flow.to).toBe('spot')
    expect(result.current.flow.available).toBe(50)
  })

  it('swap flips the direction and the available balance follows', () => {
    const h = buildTransferDeps({ spotAvailable: 100, perpsAvailable: 50 })
    const { result } = renderHook(() => useOwnTransferFlow(h.deps))
    act(() => result.current.flow.swap())
    expect(result.current.flow.from).toBe('perps')
    expect(result.current.flow.available).toBe(50)
  })

  it('isApplicable is false on a unified account', () => {
    const h = buildTransferDeps({ isSegregated: false })
    const { result } = renderHook(() => useOwnTransferFlow(h.deps))
    expect(result.current.isApplicable).toBe(false)
  })
})

describe('useOwnTransferFlow — validation', () => {
  it('invalidates an amount of 0 or below', () => {
    const h = buildTransferDeps({ spotAvailable: 100 })
    const { result } = renderHook(() => useOwnTransferFlow(h.deps))
    act(() => result.current.flow.setAmount('0'))
    expect(result.current.flow.isAmountValid).toBe(false)
    expect(result.current.flow.amountInvalidReason).toMatch(/above 0/i)
  })

  it('invalidates an amount above the available balance', () => {
    const h = buildTransferDeps({ spotAvailable: 100 })
    const { result } = renderHook(() => useOwnTransferFlow(h.deps))
    act(() => result.current.flow.setAmount('150'))
    expect(result.current.flow.isAmountValid).toBe(false)
    expect(result.current.flow.amountInvalidReason).toMatch(/exceeds/i)
  })

  it('invalidates an amount with more than 6 decimal places', () => {
    const h = buildTransferDeps({ spotAvailable: 100 })
    const { result } = renderHook(() => useOwnTransferFlow(h.deps))
    act(() => result.current.flow.setAmount('1.1234567'))
    expect(result.current.flow.isAmountValid).toBe(false)
    expect(result.current.flow.amountInvalidReason).toMatch(/decimal/i)
  })

  it('accepts a valid in-range amount', () => {
    const h = buildTransferDeps({ spotAvailable: 100 })
    const { result } = renderHook(() => useOwnTransferFlow(h.deps))
    act(() => result.current.flow.setAmount('25'))
    expect(result.current.flow.isAmountValid).toBe(true)
    expect(result.current.flow.amountInvalidReason).toBeNull()
  })

  it('does not surface an invalid reason before the field is touched', () => {
    const h = buildTransferDeps({ spotAvailable: 100 })
    const { result } = renderHook(() => useOwnTransferFlow(h.deps))
    expect(result.current.flow.isAmountValid).toBe(false)
    expect(result.current.flow.amountInvalidReason).toBeNull()
  })
})

describe('useOwnTransferFlow — MAX per direction', () => {
  it('Spot→Perp MAX fills the spot available', () => {
    const h = buildTransferDeps({ spotAvailable: 73.5, perpsAvailable: 10 })
    const { result } = renderHook(() => useOwnTransferFlow(h.deps))
    act(() => result.current.flow.setAmountToMax())
    expect(result.current.flow.amount).toBe('73.5')
    expect(result.current.flow.isAmountValid).toBe(true)
  })

  it('Perp→Spot MAX fills the perps available after a swap', () => {
    const h = buildTransferDeps({ spotAvailable: 73.5, perpsAvailable: 10 })
    const { result } = renderHook(() => useOwnTransferFlow(h.deps))
    act(() => result.current.flow.swap())
    act(() => result.current.flow.setAmountToMax())
    expect(result.current.flow.amount).toBe('10')
  })
})

describe('useOwnTransferFlow — submit', () => {
  it('signs Spot→Perp with toPerp=true, succeeds optimistically, toasts + closes', async () => {
    const h = buildTransferDeps({ spotAvailable: 100 })
    const { result } = renderHook(() => useOwnTransferFlow(h.deps))
    act(() => result.current.flow.setAmount('40'))
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('success'))
    expect(h.calls).toEqual([{ amount: '40', toPerp: true }])
    expect(h.toast.payloads).toHaveLength(1)
    expect(h.toast.payloads[0]?.variant).toBe('success')
    expect(h.closeCount()).toBe(1)
  })

  it('signs Perp→Spot with toPerp=false after a swap', async () => {
    const h = buildTransferDeps({ spotAvailable: 100, perpsAvailable: 60 })
    const { result } = renderHook(() => useOwnTransferFlow(h.deps))
    act(() => result.current.flow.swap())
    act(() => result.current.flow.setAmount('20'))
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('success'))
    expect(h.calls).toEqual([{ amount: '20', toPerp: false }])
  })

  it('blocks submit with amount-invalid when the amount is empty (no gateway call)', async () => {
    const h = buildTransferDeps({ spotAvailable: 100 })
    const { result } = renderHook(() => useOwnTransferFlow(h.deps))
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('error'))
    expect(result.current.flow.errorReason).toBe('amount-invalid')
    expect(h.calls).toHaveLength(0)
  })

  it('blocks submit with insufficient-balance when the amount exceeds available', async () => {
    const h = buildTransferDeps({ spotAvailable: 10 })
    const { result } = renderHook(() => useOwnTransferFlow(h.deps))
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
    const h = buildTransferDeps({ spotAvailable: 100, masterWallet: null })
    const { result } = renderHook(() => useOwnTransferFlow(h.deps))
    act(() => result.current.flow.setAmount('40'))
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('error'))
    expect(result.current.flow.errorReason).toBe('unknown')
    expect(h.calls).toHaveLength(0)
  })

  it('signs as the embedded SELECTED master (ADR-0060 — does not abort signing-unavailable)', async () => {
    // ADR-0060: a selected embedded Native wallet is a valid signing master — a
    // resolved `masterAddress` + a resolvable wallet means the transfer signs and
    // succeeds, never the `wallet-unavailable` abort that gated embedded users.
    const h = buildTransferDeps({ spotAvailable: 100 })
    const { result } = renderHook(() => useOwnTransferFlow(h.deps))
    act(() => result.current.flow.setAmount('40'))
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('success'))
    expect(h.calls).toEqual([{ amount: '40', toPerp: true }])
  })

  it('aborts before signing when there is no resolvable selected master (ADR-0060)', async () => {
    const h = buildTransferDeps({ spotAvailable: 100, masterAddress: null })
    const { result } = renderHook(() => useOwnTransferFlow(h.deps))
    act(() => result.current.flow.setAmount('40'))
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('error'))
    expect(result.current.flow.errorReason).toBe('unknown')
    expect(h.calls).toHaveLength(0)
  })
})

describe('useOwnTransferFlow — gateway error mapping (all typed, non-throwing)', () => {
  const cases = [
    { kind: 'wallet-rejected' as const, expected: 'wallet-rejected' },
    { kind: 'deposit-required' as const, expected: 'deposit-required' },
    { kind: 'rate-limited' as const, expected: 'rate-limited' },
    { kind: 'network' as const, expected: 'network' },
    { kind: 'invalid-response' as const, expected: 'unknown' },
  ]
  for (const { kind, expected } of cases) {
    it(`maps gateway ${kind} → ${expected} and preserves the input`, async () => {
      const h = buildTransferDeps({ spotAvailable: 100, transferOutcome: TRANSFER_ERROR(kind) })
      const { result } = renderHook(() => useOwnTransferFlow(h.deps))
      act(() => result.current.flow.setAmount('30'))
      await act(async () => {
        result.current.flow.submit()
        await Promise.resolve()
      })
      await waitFor(() => expect(result.current.flow.phase).toBe('error'))
      expect(result.current.flow.errorReason).toBe(expected)
      // input preserved + no toast / close on failure
      expect(result.current.flow.amount).toBe('30')
      expect(h.toast.payloads).toHaveLength(0)
      expect(h.closeCount()).toBe(0)
    })
  }

  it('retry clears the error back to idle with the amount preserved', async () => {
    const h = buildTransferDeps({ spotAvailable: 100, transferOutcome: TRANSFER_ERROR('network') })
    const { result } = renderHook(() => useOwnTransferFlow(h.deps))
    act(() => result.current.flow.setAmount('30'))
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('error'))
    act(() => result.current.flow.retry())
    expect(result.current.flow.phase).toBe('idle')
    expect(result.current.flow.amount).toBe('30')
    expect(result.current.flow.errorReason).toBeNull()
  })
})
