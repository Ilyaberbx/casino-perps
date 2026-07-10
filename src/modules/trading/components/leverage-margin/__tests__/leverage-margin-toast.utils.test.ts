import { describe, it, expect } from 'vitest'
import { SetLeverageError, SetMarginModeError } from '@/modules/shared/domain'
import {
  buildLeverageAppliedToast,
  buildLeverageErrorToast,
  buildMarginModeAppliedToast,
  buildMarginModeErrorToast,
} from '../leverage-margin-toast.utils'

describe('leverage-margin toast builders', () => {
  it('builds a success toast for an applied leverage (display symbol stripped of -PERP)', () => {
    const payload = buildLeverageAppliedToast('BTC-PERP', 10)
    expect(payload.variant).toBe('success')
    expect(payload.title).toBe('Multiplier updated')
    expect(payload.description).toContain('10x')
    expect(payload.description).toContain('BTC')
    expect(payload.description).not.toContain('BTC-PERP')
  })

  it('passes the raw leverage rejection reason through', () => {
    const payload = buildLeverageErrorToast(new SetLeverageError('rejected', 'no signer'))
    expect(payload.variant).toBe('error')
    expect(payload.description).toBe('no signer')
  })

  it('labels cross and isolated margin modes', () => {
    expect(buildMarginModeAppliedToast('BTC-PERP', 'cross').description).toContain('Cross')
    expect(buildMarginModeAppliedToast('BTC-PERP', 'isolated').description).toContain('Isolated')
  })

  it('passes the raw margin-mode rejection reason through', () => {
    const payload = buildMarginModeErrorToast(new SetMarginModeError('rejected', 'nope'))
    expect(payload.variant).toBe('error')
    expect(payload.description).toBe('nope')
  })
})
