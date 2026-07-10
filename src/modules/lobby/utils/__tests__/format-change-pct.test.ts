import { describe, it, expect } from 'vitest'
import { formatChangePct } from '../format-change-pct'

describe('formatChangePct', () => {
  it('prefixes a positive change with +', () => {
    expect(formatChangePct(2.4)).toBe('+2.4%')
  })

  it('prefixes a negative change with -', () => {
    expect(formatChangePct(-3.1)).toBe('-3.1%')
  })

  it('rounds to a single decimal', () => {
    expect(formatChangePct(-3.16)).toBe('-3.2%')
    expect(formatChangePct(0.04)).toBe('+0.0%')
  })

  it('normalizes negative zero to +0.0%', () => {
    expect(formatChangePct(-0)).toBe('+0.0%')
    expect(formatChangePct(0)).toBe('+0.0%')
  })
})
