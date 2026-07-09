import { describe, it, expect } from 'vitest'
import { SetPositionProtectionError } from '../../../shared/domain'
import { createMockPositionProtection } from '../mock-position-protection'

function build(hasPosition = true) {
  return createMockPositionProtection({
    isKnownSymbol: (symbol) => symbol === 'BTC',
    hasPosition: () => hasPosition,
  })
}

describe('createMockPositionProtection', () => {
  it('records TP/SL legs for a symbol with an open position', async () => {
    const state = build()
    const result = await state.positionProtection.setProtection('BTC', {
      takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 70_000 } },
    })
    expect(result.isOk()).toBe(true)
    expect(state.protectionFor('BTC')).toBeDefined()
  })

  it('reflects partial size and limit price back (ADR-0054 D-4)', async () => {
    const state = build()
    await state.positionProtection.setProtection('BTC', {
      takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 70_000 }, size: 0.5, limitPrice: 69_500 },
    })
    expect(state.protectionFor('BTC')?.takeProfit).toMatchObject({ size: 0.5, limitPrice: 69_500 })
  })

  it('rejects no-position', async () => {
    const state = build(false)
    const result = await state.positionProtection.setProtection('BTC', {
      stopLoss: { kind: 'stop-loss', trigger: { type: 'price', price: 50_000 } },
    })
    expect(result.isErr()).toBe(true)
    result.match(
      () => expect.fail('expected error'),
      (e) => expect((e as SetPositionProtectionError).kind).toBe('no-position'),
    )
  })

  it('rejects an unknown symbol', async () => {
    const state = build()
    const result = await state.positionProtection.setProtection('NOPE', {
      takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 1 } },
    })
    expect(result.isErr()).toBe(true)
  })

  it('rejects when no leg is supplied', async () => {
    const state = build()
    const result = await state.positionProtection.setProtection('BTC', {})
    expect(result.isErr()).toBe(true)
    result.match(
      () => expect.fail('expected error'),
      (e) => expect((e as SetPositionProtectionError).kind).toBe('invalid-trigger'),
    )
  })

  it('clears recorded protection', async () => {
    const state = build()
    await state.positionProtection.setProtection('BTC', {
      takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 70_000 } },
    })
    await state.positionProtection.clearProtection('BTC')
    expect(state.protectionFor('BTC')).toBeUndefined()
  })
})
