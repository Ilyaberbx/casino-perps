import { describe, expect, it } from 'vitest'
import type { DepositFlowMachineState } from '../deposit-flow-provider.types'
import { depositFlowReducer, INITIAL_DEPOSIT_FLOW_STATE } from '../deposit-flow.reducer'

const READY: DepositFlowMachineState = {
  phase: 'ready',
  walletUsdc: 100,
  amount: '50',
  amountTouched: true,
}

describe('depositFlowReducer', () => {
  it('starts in checking with an empty, untouched amount', () => {
    expect(INITIAL_DEPOSIT_FLOW_STATE).toEqual({
      phase: 'checking',
      walletUsdc: 0,
      amount: '',
      amountTouched: false,
    })
  })

  it('PREFLIGHT_RESOLVED sets phase + walletUsdc, keeps amount', () => {
    const next = depositFlowReducer(
      { ...INITIAL_DEPOSIT_FLOW_STATE, amount: '7', amountTouched: true },
      { type: 'PREFLIGHT_RESOLVED', phase: 'ready', walletUsdc: 42 },
    )
    expect(next).toEqual({ phase: 'ready', walletUsdc: 42, amount: '7', amountTouched: true })
  })

  it('BALANCE_TICK updates only walletUsdc, preserving the current phase', () => {
    const next = depositFlowReducer(
      { ...INITIAL_DEPOSIT_FLOW_STATE, phase: 'needs-funding' },
      { type: 'BALANCE_TICK', walletUsdc: 3 },
    )
    expect(next.phase).toBe('needs-funding')
    expect(next.walletUsdc).toBe(3)
  })

  it('FUNDING_ARRIVED moves to ready with the new balance', () => {
    const next = depositFlowReducer(
      { ...INITIAL_DEPOSIT_FLOW_STATE, phase: 'needs-funding' },
      { type: 'FUNDING_ARRIVED', walletUsdc: 25 },
    )
    expect(next.phase).toBe('ready')
    expect(next.walletUsdc).toBe(25)
  })

  it('AMOUNT_CHANGED sets amount and marks touched', () => {
    const next = depositFlowReducer(INITIAL_DEPOSIT_FLOW_STATE, {
      type: 'AMOUNT_CHANGED',
      amount: '12',
    })
    expect(next.amount).toBe('12')
    expect(next.amountTouched).toBe(true)
  })

  it('SUBMITTED → signing, then TRANSFER_SENT → sent carrying the hash', () => {
    const signing = depositFlowReducer(READY, { type: 'SUBMITTED' })
    expect(signing.phase).toBe('signing')
    const sent = depositFlowReducer(signing, {
      type: 'TRANSFER_SENT',
      transactionHash: '0xabc',
    })
    expect(sent.phase).toBe('sent')
    if (sent.phase !== 'sent') throw new Error('expected sent')
    expect(sent.transactionHash).toBe('0xabc')
    // amount preserved across the transition
    expect(sent.amount).toBe('50')
  })

  it('CREDITED keeps the sent transaction hash', () => {
    const sent = depositFlowReducer(
      { ...READY, phase: 'signing' },
      { type: 'TRANSFER_SENT', transactionHash: '0xfeed' },
    )
    const credited = depositFlowReducer(sent, { type: 'CREDITED' })
    expect(credited.phase).toBe('credited')
    if (credited.phase !== 'credited') throw new Error('expected credited')
    expect(credited.transactionHash).toBe('0xfeed')
  })

  it('CREDITED is a no-op when not coming from sent (only sent carries a hash)', () => {
    const next = depositFlowReducer(READY, { type: 'CREDITED' })
    expect(next).toEqual(READY)
  })

  it('TRANSFER_REJECTED returns to ready (amount kept)', () => {
    const next = depositFlowReducer({ ...READY, phase: 'signing' }, { type: 'TRANSFER_REJECTED' })
    expect(next.phase).toBe('ready')
    expect(next.amount).toBe('50')
  })

  it('SWITCH_REJECTED returns to wrong-chain', () => {
    const next = depositFlowReducer(
      { ...INITIAL_DEPOSIT_FLOW_STATE, phase: 'wrong-chain' },
      { type: 'SWITCH_REJECTED' },
    )
    expect(next.phase).toBe('wrong-chain')
  })

  it('FAILED carries the reason on the error phase', () => {
    const next = depositFlowReducer(READY, { type: 'FAILED', reason: 'transfer-failed' })
    expect(next.phase).toBe('error')
    if (next.phase !== 'error') throw new Error('expected error')
    expect(next.errorReason).toBe('transfer-failed')
    // amount survives the error so retry never loses it
    expect(next.amount).toBe('50')
  })

  it('RETRY returns to checking, dropping the prior error reason', () => {
    const errored = depositFlowReducer(READY, { type: 'FAILED', reason: 'unknown' })
    const next = depositFlowReducer(errored, { type: 'RETRY' })
    expect(next.phase).toBe('checking')
    // no errorReason field on a non-error phase — illegal state unrepresentable
    expect('errorReason' in next).toBe(false)
  })
})
