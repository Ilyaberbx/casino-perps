import { describe, expect, it } from 'vitest'
import { createFlowTransitions } from '../flow-reducer'

const carried = { amount: '40', amountTouched: true } as const

describe('createFlowTransitions', () => {
  it('reviewed() carries the form fields onto the review phase', () => {
    const next = createFlowTransitions<typeof carried, 'network'>(carried).reviewed()
    expect(next).toEqual({ amount: '40', amountTouched: true, phase: 'review' })
  })

  it('toForm() carries the form fields onto the form phase', () => {
    const next = createFlowTransitions<typeof carried, 'network'>(carried).toForm()
    expect(next).toEqual({ amount: '40', amountTouched: true, phase: 'form' })
  })

  it('signing() lands on signing', () => {
    const next = createFlowTransitions<typeof carried, 'network'>(carried).signing()
    expect(next.phase).toBe('signing')
  })

  it('failed(reason) carries the typed reason onto error', () => {
    const next = createFlowTransitions<typeof carried, 'network'>(carried).failed('network')
    expect(next).toEqual({ amount: '40', amountTouched: true, phase: 'error', errorReason: 'network' })
  })

  it('sent({}) lands on sent with no extra payload', () => {
    const next = createFlowTransitions<typeof carried, 'network'>(carried).sent({})
    expect(next).toEqual({ amount: '40', amountTouched: true, phase: 'sent' })
  })

  it('sent(extra) folds the flow-specific payload onto sent', () => {
    const next = createFlowTransitions<
      typeof carried,
      'network',
      { readonly transactionHash: `0x${string}` | null }
    >(carried).sent({ transactionHash: '0xabc' })
    expect(next).toEqual({
      amount: '40',
      amountTouched: true,
      phase: 'sent',
      transactionHash: '0xabc',
    })
  })

  it('does not mutate the carried base', () => {
    const base = { ...carried }
    createFlowTransitions<typeof carried, 'network'>(base).failed('network')
    expect(base).toEqual(carried)
  })
})
