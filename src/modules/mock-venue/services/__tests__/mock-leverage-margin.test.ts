import { describe, it, expect } from 'vitest'
import { SetLeverageError, SetMarginModeError } from '../../../shared/domain'
import { createMockLeverageMargin } from '../mock-leverage-margin'

function build(maxLeverage: number | null = 50) {
  return createMockLeverageMargin({
    maxLeverageFor: () => maxLeverage,
    isKnownSymbol: (symbol) => symbol === 'BTC',
  })
}

describe('createMockLeverageMargin.leverageController', () => {
  it('sets and reads back a valid leverage', async () => {
    const state = build()
    const result = await state.leverageController.setLeverage('BTC', 10)
    expect(result.isOk()).toBe(true)
    expect(state.leverageFor('BTC')).toBe(10)
  })

  it('defaults to 1x before any set', () => {
    const state = build()
    expect(state.leverageFor('BTC')).toBe(1)
  })

  it('rejects an unknown symbol', async () => {
    const state = build()
    const result = await state.leverageController.setLeverage('NOPE', 10)
    expect(result.isErr()).toBe(true)
    result.match(
      () => expect.fail('expected error'),
      (e) => expect((e as SetLeverageError).kind).toBe('unknown-symbol'),
    )
  })

  it('rejects leverage below 1 and above the market max', async () => {
    const state = build(20)
    const tooLow = await state.leverageController.setLeverage('BTC', 0)
    const tooHigh = await state.leverageController.setLeverage('BTC', 21)
    expect(tooLow.isErr()).toBe(true)
    expect(tooHigh.isErr()).toBe(true)
    tooHigh.match(
      () => expect.fail('expected error'),
      (e) => expect((e as SetLeverageError).kind).toBe('invalid-leverage'),
    )
  })
})

describe('createMockLeverageMargin.marginModeController', () => {
  it('sets and reads back the margin mode; defaults to cross', async () => {
    const state = build()
    expect(state.marginModeFor('BTC')).toBe('cross')
    const result = await state.marginModeController.setMarginMode('BTC', 'isolated')
    expect(result.isOk()).toBe(true)
    expect(state.marginModeFor('BTC')).toBe('isolated')
  })

  it('rejects an unknown symbol', async () => {
    const state = build()
    const result = await state.marginModeController.setMarginMode('NOPE', 'isolated')
    expect(result.isErr()).toBe(true)
    result.match(
      () => expect.fail('expected error'),
      (e) => expect((e as SetMarginModeError).kind).toBe('unknown-symbol'),
    )
  })
})
