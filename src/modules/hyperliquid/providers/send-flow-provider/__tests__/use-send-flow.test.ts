import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useOwnSendFlow } from '../use-send-flow'
import {
  buildSendDeps,
  HYPE_TOKEN,
  OTHER_ADDRESS,
  SEND_ERROR,
  USDC_TOKEN,
} from '../__fixtures__/fake-send-flow-deps'

const MASTER = '0x1111111111111111111111111111111111111111'

describe('useOwnSendFlow — initial state', () => {
  it('starts on the form, USDC selected, empty destination, applicable', () => {
    const h = buildSendDeps()
    const { result } = renderHook(() => useOwnSendFlow(h.deps))
    expect(result.current.flow.phase).toBe('form')
    expect(result.current.flow.symbol).toBe('USDC')
    expect(result.current.flow.available).toBe(100)
    expect(result.current.flow.destination).toBe('')
    expect(result.current.isApplicable).toBe(true)
  })

  it('isApplicable is false when no master resolves', () => {
    const h = buildSendDeps({ masterAddress: null })
    const { result } = renderHook(() => useOwnSendFlow(h.deps))
    expect(result.current.isApplicable).toBe(false)
  })

  it('isApplicable is false when no tokens are sendable', () => {
    const h = buildSendDeps({ tokens: [] })
    const { result } = renderHook(() => useOwnSendFlow(h.deps))
    expect(result.current.isApplicable).toBe(false)
  })
})

describe('useOwnSendFlow — token selection', () => {
  it('selecting a spot token switches the symbol/available and clears the amount', () => {
    const h = buildSendDeps()
    const { result } = renderHook(() => useOwnSendFlow(h.deps))
    act(() => result.current.flow.setAmount('40'))
    act(() => result.current.flow.selectToken(HYPE_TOKEN.key))
    expect(result.current.flow.symbol).toBe('HYPE')
    expect(result.current.flow.available).toBe(50)
    expect(result.current.flow.amount).toBe('')
  })

  it('MAX fills the selected token available', () => {
    const h = buildSendDeps()
    const { result } = renderHook(() => useOwnSendFlow(h.deps))
    act(() => result.current.flow.selectToken(HYPE_TOKEN.key))
    act(() => result.current.flow.setAmountToMax())
    expect(result.current.flow.amount).toBe('50')
  })

  it('setPercent(50) fills half the selected token available', () => {
    const h = buildSendDeps()
    const { result } = renderHook(() => useOwnSendFlow(h.deps))
    act(() => result.current.flow.setPercent(50))
    expect(result.current.flow.amount).toBe('50')
  })
})

describe('useOwnSendFlow — amount + destination validation', () => {
  it('invalidates an amount above the available cap', () => {
    const h = buildSendDeps()
    const { result } = renderHook(() => useOwnSendFlow(h.deps))
    act(() => result.current.flow.setAmount('150'))
    expect(result.current.flow.isAmountValid).toBe(false)
    expect(result.current.flow.amountInvalidReason).toMatch(/exceeds/i)
  })

  it('rejects a self-send to the user own address', () => {
    const h = buildSendDeps()
    const { result } = renderHook(() => useOwnSendFlow(h.deps))
    act(() => result.current.flow.setDestination(MASTER))
    expect(result.current.flow.isDestinationValid).toBe(false)
    expect(result.current.flow.destinationInvalidReason).toMatch(/your own address/i)
    expect(result.current.flow.canReview).toBe(false)
  })

  it('blocks review with a malformed recipient', () => {
    const h = buildSendDeps()
    const { result } = renderHook(() => useOwnSendFlow(h.deps))
    act(() => result.current.flow.setAmount('40'))
    act(() => result.current.flow.setDestination('0x123'))
    expect(result.current.flow.isDestinationValid).toBe(false)
    expect(result.current.flow.canReview).toBe(false)
  })

  it('allows review with a valid amount + distinct recipient', () => {
    const h = buildSendDeps()
    const { result } = renderHook(() => useOwnSendFlow(h.deps))
    act(() => result.current.flow.setAmount('40'))
    act(() => result.current.flow.setDestination(OTHER_ADDRESS))
    expect(result.current.flow.canReview).toBe(true)
    act(() => result.current.flow.review())
    expect(result.current.flow.phase).toBe('review')
  })

  it('back returns review → form with input preserved', () => {
    const h = buildSendDeps()
    const { result } = renderHook(() => useOwnSendFlow(h.deps))
    act(() => result.current.flow.setAmount('40'))
    act(() => result.current.flow.setDestination(OTHER_ADDRESS))
    act(() => result.current.flow.review())
    act(() => result.current.flow.back())
    expect(result.current.flow.phase).toBe('form')
    expect(result.current.flow.amount).toBe('40')
    expect(result.current.flow.destination).toBe(OTHER_ADDRESS)
  })
})

describe('useOwnSendFlow — submit routing', () => {
  it('USDC routes via usdSend, lands on sent, toasts + calls onSuccess', async () => {
    const h = buildSendDeps()
    const { result } = renderHook(() => useOwnSendFlow(h.deps))
    act(() => result.current.flow.setAmount('40'))
    act(() => result.current.flow.setDestination(OTHER_ADDRESS))
    act(() => result.current.flow.review())
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('sent'))
    expect(h.usdCalls).toEqual([{ destination: OTHER_ADDRESS, amount: '40' }])
    expect(h.spotCalls).toHaveLength(0)
    expect(h.toast.payloads[0]?.variant).toBe('success')
    expect(h.successCount()).toBe(1)
    expect(h.recordedRecipients).toEqual([OTHER_ADDRESS])
  })

  it('does not record the recipient when the send fails', async () => {
    const h = buildSendDeps({ sendOutcome: SEND_ERROR('network') })
    const { result } = renderHook(() => useOwnSendFlow(h.deps))
    act(() => result.current.flow.setAmount('40'))
    act(() => result.current.flow.setDestination(OTHER_ADDRESS))
    act(() => result.current.flow.review())
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('error'))
    expect(h.recordedRecipients).toHaveLength(0)
  })

  it('a spot token routes via spotSend with its NAME:0xTOKENID', async () => {
    const h = buildSendDeps()
    const { result } = renderHook(() => useOwnSendFlow(h.deps))
    act(() => result.current.flow.selectToken(HYPE_TOKEN.key))
    act(() => result.current.flow.setAmount('30'))
    act(() => result.current.flow.setDestination(OTHER_ADDRESS))
    act(() => result.current.flow.review())
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('sent'))
    expect(h.spotCalls).toEqual([
      { destination: OTHER_ADDRESS, token: HYPE_TOKEN.tokenId, amount: '30' },
    ])
    expect(h.usdCalls).toHaveLength(0)
  })

  it('blocks submit with insufficient-balance when the amount exceeds the cap', async () => {
    const h = buildSendDeps({ tokens: [{ ...USDC_TOKEN, available: 10 }] })
    const { result } = renderHook(() => useOwnSendFlow(h.deps))
    act(() => result.current.flow.setAmount('50'))
    act(() => result.current.flow.setDestination(OTHER_ADDRESS))
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('error'))
    expect(result.current.flow.errorReason).toBe('insufficient-balance')
    expect(h.usdCalls).toHaveLength(0)
  })

  it('rejects a self-send on submit', async () => {
    const h = buildSendDeps()
    const { result } = renderHook(() => useOwnSendFlow(h.deps))
    act(() => result.current.flow.setAmount('40'))
    act(() => result.current.flow.setDestination(MASTER))
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('error'))
    expect(result.current.flow.errorReason).toBe('self-send')
    expect(h.usdCalls).toHaveLength(0)
  })

  it('errors with unknown when the master wallet cannot be resolved', async () => {
    const h = buildSendDeps({ masterWallet: null })
    const { result } = renderHook(() => useOwnSendFlow(h.deps))
    act(() => result.current.flow.setAmount('40'))
    act(() => result.current.flow.setDestination(OTHER_ADDRESS))
    act(() => result.current.flow.review())
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('error'))
    expect(result.current.flow.errorReason).toBe('unknown')
    expect(h.usdCalls).toHaveLength(0)
  })
})

describe('useOwnSendFlow — gateway errors + recovery', () => {
  const cases = [
    { kind: 'wallet-rejected' as const, expected: 'wallet-rejected' },
    { kind: 'rate-limited' as const, expected: 'rate-limited' },
    { kind: 'network' as const, expected: 'network' },
    { kind: 'invalid-response' as const, expected: 'unknown' },
  ]
  for (const { kind, expected } of cases) {
    it(`maps gateway ${kind} → ${expected} and preserves input`, async () => {
      const h = buildSendDeps({ sendOutcome: SEND_ERROR(kind) })
      const { result } = renderHook(() => useOwnSendFlow(h.deps))
      act(() => result.current.flow.setAmount('30'))
      act(() => result.current.flow.setDestination(OTHER_ADDRESS))
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
    const h = buildSendDeps({ sendOutcome: SEND_ERROR('network') })
    const { result } = renderHook(() => useOwnSendFlow(h.deps))
    act(() => result.current.flow.setAmount('30'))
    act(() => result.current.flow.setDestination(OTHER_ADDRESS))
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

  it('reset returns to a fresh form', async () => {
    const h = buildSendDeps()
    const { result } = renderHook(() => useOwnSendFlow(h.deps))
    act(() => result.current.flow.setAmount('40'))
    act(() => result.current.flow.setDestination(OTHER_ADDRESS))
    act(() => result.current.flow.review())
    await act(async () => {
      result.current.flow.submit()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.flow.phase).toBe('sent'))
    act(() => result.current.flow.reset())
    expect(result.current.flow.phase).toBe('form')
    expect(result.current.flow.amount).toBe('')
    expect(result.current.flow.destination).toBe('')
  })
})
