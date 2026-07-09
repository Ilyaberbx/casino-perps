import { describe, it, expect } from 'vitest'
import { visibleScopeOptions } from '../portfolio-summary-card.utils'

describe('visibleScopeOptions', () => {
  it('segregated account keeps both All and Only Perps options', () => {
    const options = visibleScopeOptions(true)
    const values = options.map((o) => o.value)
    expect(values).toContain('all')
    expect(values).toContain('perps')
  })

  it('unified account drops the perps option, keeps all', () => {
    const options = visibleScopeOptions(false)
    const values = options.map((o) => o.value)
    expect(values).toContain('all')
    expect(values).not.toContain('perps')
  })
})
