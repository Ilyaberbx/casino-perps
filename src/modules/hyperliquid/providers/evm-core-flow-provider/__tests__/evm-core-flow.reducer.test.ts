import { describe, expect, it } from 'vitest'
import { INITIAL_EVM_CORE_FLOW_STATE, evmCoreFlowReducer } from '../evm-core-flow.reducer'
import type { EvmCoreMachineState } from '../evm-core-flow-provider.types'

const FORM_WITH_INPUT: EvmCoreMachineState = {
  phase: 'form',
  direction: 'core-to-evm',
  selectedTokenKey: 'evm-core:BTC',
  amount: '1.5',
  amountTouched: true,
}

describe('evmCoreFlowReducer', () => {
  it('starts Core→EVM on the form with an empty amount', () => {
    expect(INITIAL_EVM_CORE_FLOW_STATE.phase).toBe('form')
    expect(INITIAL_EVM_CORE_FLOW_STATE.direction).toBe('core-to-evm')
    expect(INITIAL_EVM_CORE_FLOW_STATE.amount).toBe('')
  })

  it('DIRECTION_CHANGED switches direction and clears the amount', () => {
    const next = evmCoreFlowReducer(FORM_WITH_INPUT, {
      type: 'DIRECTION_CHANGED',
      direction: 'evm-to-core',
    })
    expect(next.direction).toBe('evm-to-core')
    expect(next.amount).toBe('')
    expect(next.amountTouched).toBe(false)
  })

  it('TOKEN_SELECTED switches the token and clears the amount', () => {
    const next = evmCoreFlowReducer(FORM_WITH_INPUT, {
      type: 'TOKEN_SELECTED',
      key: 'evm-core:HYPE',
    })
    expect(next.selectedTokenKey).toBe('evm-core:HYPE')
    expect(next.amount).toBe('')
  })

  it('REVIEWED → SUBMITTED → SENT advances the phase, preserving input', () => {
    const reviewed = evmCoreFlowReducer(FORM_WITH_INPUT, { type: 'REVIEWED' })
    expect(reviewed.phase).toBe('review')
    const signing = evmCoreFlowReducer(reviewed, { type: 'SUBMITTED' })
    expect(signing.phase).toBe('signing')
    const sent = evmCoreFlowReducer(signing, { type: 'SENT', transactionHash: null })
    expect(sent.phase).toBe('sent')
    expect(sent.amount).toBe('1.5')
    if (sent.phase === 'sent') expect(sent.transactionHash).toBeNull()
  })

  it('FAILED carries the reason and preserves input; RETRY clears it back to the form', () => {
    const failed = evmCoreFlowReducer(FORM_WITH_INPUT, { type: 'FAILED', reason: 'network' })
    expect(failed.phase).toBe('error')
    if (failed.phase === 'error') expect(failed.errorReason).toBe('network')
    expect(failed.amount).toBe('1.5')
    const retried = evmCoreFlowReducer(failed, { type: 'RETRY' })
    expect(retried.phase).toBe('form')
    expect(retried.amount).toBe('1.5')
  })

  it('RESET returns to a fresh form but keeps the active direction', () => {
    const evmToCore = evmCoreFlowReducer(FORM_WITH_INPUT, {
      type: 'DIRECTION_CHANGED',
      direction: 'evm-to-core',
    })
    const reset = evmCoreFlowReducer(evmToCore, {
      type: 'RESET',
      selectedTokenKey: 'evm-core:HYPE',
    })
    expect(reset.phase).toBe('form')
    expect(reset.amount).toBe('')
    expect(reset.direction).toBe('evm-to-core')
    expect(reset.selectedTokenKey).toBe('evm-core:HYPE')
  })
})
