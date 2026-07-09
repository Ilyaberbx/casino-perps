import { describe, it, expect } from 'vitest'
import { PlaceOrderError, CancelOrderError, ModifyOrderError } from '../trader'
import { SetLeverageError } from '../leverage-controller'
import { SetMarginModeError } from '../margin-mode-controller'
import { SetPositionProtectionError } from '../position-protection'

describe('trading capability error classes', () => {
  it('PlaceOrderError carries kind, message, name and is an Error', () => {
    const error = new PlaceOrderError('rejected', 'venue said no')
    expect(error).toBeInstanceOf(Error)
    expect(error.kind).toBe('rejected')
    expect(error.message).toBe('venue said no')
    expect(error.name).toBe('PlaceOrderError')
  })

  it('CancelOrderError carries kind and name', () => {
    const error = new CancelOrderError('not-found', 'no such order')
    expect(error).toBeInstanceOf(Error)
    expect(error.kind).toBe('not-found')
    expect(error.name).toBe('CancelOrderError')
  })

  it('ModifyOrderError carries kind and name', () => {
    const error = new ModifyOrderError('invalid-price', 'bad price')
    expect(error).toBeInstanceOf(Error)
    expect(error.kind).toBe('invalid-price')
    expect(error.name).toBe('ModifyOrderError')
  })

  it('SetLeverageError carries kind and name', () => {
    const error = new SetLeverageError('invalid-leverage', 'too high')
    expect(error).toBeInstanceOf(Error)
    expect(error.kind).toBe('invalid-leverage')
    expect(error.name).toBe('SetLeverageError')
  })

  it('SetMarginModeError carries kind and name', () => {
    const error = new SetMarginModeError('rejected', 'denied')
    expect(error).toBeInstanceOf(Error)
    expect(error.kind).toBe('rejected')
    expect(error.name).toBe('SetMarginModeError')
  })

  it('SetPositionProtectionError carries kind and name', () => {
    const error = new SetPositionProtectionError('no-position', 'flat')
    expect(error).toBeInstanceOf(Error)
    expect(error.kind).toBe('no-position')
    expect(error.name).toBe('SetPositionProtectionError')
  })
})
