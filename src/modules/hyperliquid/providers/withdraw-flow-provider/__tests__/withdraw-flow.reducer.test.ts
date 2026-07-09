import { describe, expect, it } from 'vitest'
import {
  INITIAL_WITHDRAW_FLOW_STATE,
  withdrawFlowReducer,
} from '../withdraw-flow.reducer'
import type { WithdrawMachineState } from '../withdraw-flow-provider.types'

const seeded: WithdrawMachineState = {
  ...INITIAL_WITHDRAW_FLOW_STATE,
  amount: '40',
  amountTouched: true,
  destination: '0x1111111111111111111111111111111111111111',
}

describe('withdrawFlowReducer', () => {
  it('AMOUNT_CHANGED sets the amount + marks touched', () => {
    const next = withdrawFlowReducer(INITIAL_WITHDRAW_FLOW_STATE, {
      type: 'AMOUNT_CHANGED',
      amount: '5',
    })
    expect(next.amount).toBe('5')
    expect(next.amountTouched).toBe(true)
  })

  it('DESTINATION_CHANGED sets the destination + marks edited', () => {
    const next = withdrawFlowReducer(INITIAL_WITHDRAW_FLOW_STATE, {
      type: 'DESTINATION_CHANGED',
      destination: '0xabc',
    })
    expect(next.destination).toBe('0xabc')
    expect(next.isDestinationEdited).toBe(true)
  })

  it('CONFIRM_TOGGLED flips the irreversible flag', () => {
    const on = withdrawFlowReducer(INITIAL_WITHDRAW_FLOW_STATE, { type: 'CONFIRM_TOGGLED' })
    expect(on.confirmedIrreversible).toBe(true)
    const off = withdrawFlowReducer(on, { type: 'CONFIRM_TOGGLED' })
    expect(off.confirmedIrreversible).toBe(false)
  })

  it('REVIEWED → BACK round-trips and preserves form fields', () => {
    const reviewed = withdrawFlowReducer(seeded, { type: 'REVIEWED' })
    expect(reviewed.phase).toBe('review')
    const back = withdrawFlowReducer(reviewed, { type: 'BACK' })
    expect(back.phase).toBe('form')
    expect(back.amount).toBe('40')
    expect(back.destination).toBe(seeded.destination)
  })

  it('SUBMITTED → FAILED carries the typed reason + preserves input', () => {
    const signing = withdrawFlowReducer(seeded, { type: 'SUBMITTED' })
    expect(signing.phase).toBe('signing')
    const failed = withdrawFlowReducer(signing, { type: 'FAILED', reason: 'network' })
    expect(failed.phase).toBe('error')
    if (failed.phase === 'error') expect(failed.errorReason).toBe('network')
    expect(failed.amount).toBe('40')
  })

  it('SENT lands on the arrival track', () => {
    const sent = withdrawFlowReducer(seeded, { type: 'SENT' })
    expect(sent.phase).toBe('sent')
  })

  it('RETRY returns to the form preserving input', () => {
    const errored = withdrawFlowReducer(seeded, { type: 'FAILED', reason: 'unknown' })
    const retried = withdrawFlowReducer(errored, { type: 'RETRY' })
    expect(retried.phase).toBe('form')
    expect(retried.amount).toBe('40')
  })

  it('RESET clears to a fresh form prefilled to the given destination', () => {
    const reset = withdrawFlowReducer(seeded, {
      type: 'RESET',
      destination: '0x9999999999999999999999999999999999999999',
    })
    expect(reset.phase).toBe('form')
    expect(reset.amount).toBe('')
    expect(reset.amountTouched).toBe(false)
    expect(reset.destination).toBe('0x9999999999999999999999999999999999999999')
    expect(reset.isDestinationEdited).toBe(false)
    expect(reset.confirmedIrreversible).toBe(false)
  })
})
