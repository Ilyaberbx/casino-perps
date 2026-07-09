import { describe, expect, it } from 'vitest'
import { INITIAL_SEND_FLOW_STATE, sendFlowReducer } from '../send-flow.reducer'
import type { SendMachineState } from '../send-flow-provider.types'

const seeded: SendMachineState = {
  ...INITIAL_SEND_FLOW_STATE,
  amount: '40',
  amountTouched: true,
  destination: '0x2222222222222222222222222222222222222222',
  destinationTouched: true,
}

describe('sendFlowReducer', () => {
  it('TOKEN_SELECTED switches the token + clears the amount', () => {
    const next = sendFlowReducer(
      { ...INITIAL_SEND_FLOW_STATE, amount: '40', amountTouched: true },
      { type: 'TOKEN_SELECTED', key: 'spot:HYPE' },
    )
    expect(next.selectedTokenKey).toBe('spot:HYPE')
    expect(next.amount).toBe('')
    expect(next.amountTouched).toBe(false)
  })

  it('AMOUNT_CHANGED sets the amount + marks touched', () => {
    const next = sendFlowReducer(INITIAL_SEND_FLOW_STATE, { type: 'AMOUNT_CHANGED', amount: '5' })
    expect(next.amount).toBe('5')
    expect(next.amountTouched).toBe(true)
  })

  it('DESTINATION_CHANGED sets the destination + marks touched', () => {
    const next = sendFlowReducer(INITIAL_SEND_FLOW_STATE, {
      type: 'DESTINATION_CHANGED',
      destination: '0xabc',
    })
    expect(next.destination).toBe('0xabc')
    expect(next.destinationTouched).toBe(true)
  })

  it('REVIEWED → BACK round-trips and preserves form fields', () => {
    const reviewed = sendFlowReducer(seeded, { type: 'REVIEWED' })
    expect(reviewed.phase).toBe('review')
    const back = sendFlowReducer(reviewed, { type: 'BACK' })
    expect(back.phase).toBe('form')
    expect(back.amount).toBe('40')
    expect(back.destination).toBe(seeded.destination)
  })

  it('SUBMITTED → FAILED carries the typed reason + preserves input', () => {
    const signing = sendFlowReducer(seeded, { type: 'SUBMITTED' })
    expect(signing.phase).toBe('signing')
    const failed = sendFlowReducer(signing, { type: 'FAILED', reason: 'network' })
    expect(failed.phase).toBe('error')
    if (failed.phase === 'error') expect(failed.errorReason).toBe('network')
    expect(failed.amount).toBe('40')
  })

  it('SENT lands on the confirmation', () => {
    const sent = sendFlowReducer(seeded, { type: 'SENT' })
    expect(sent.phase).toBe('sent')
  })

  it('RETRY returns to the form preserving input', () => {
    const errored = sendFlowReducer(seeded, { type: 'FAILED', reason: 'unknown' })
    const retried = sendFlowReducer(errored, { type: 'RETRY' })
    expect(retried.phase).toBe('form')
    expect(retried.amount).toBe('40')
  })

  it('RESET clears to a fresh form with the given selected token', () => {
    const reset = sendFlowReducer(seeded, { type: 'RESET', selectedTokenKey: 'spot:HYPE' })
    expect(reset.phase).toBe('form')
    expect(reset.amount).toBe('')
    expect(reset.amountTouched).toBe(false)
    expect(reset.destination).toBe('')
    expect(reset.destinationTouched).toBe(false)
    expect(reset.selectedTokenKey).toBe('spot:HYPE')
  })
})
