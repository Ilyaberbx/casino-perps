import { describe, it, expect } from 'vitest'
import { generateCloid } from '../generate-cloid'

const CLOID_PATTERN = /^0x[0-9a-f]{32}$/

describe('generateCloid', () => {
  it('produces a 0x-prefixed 32-hex-char cloid', () => {
    const cloid = generateCloid('a99a')
    expect(cloid).toMatch(CLOID_PATTERN)
  })

  it('stamps the prefix into the leading hex digits', () => {
    const cloid = generateCloid('a99a', (length) => '0'.repeat(length))
    expect(cloid).toBe(`0x${'a99a'}${'0'.repeat(28)}`)
  })

  it('lower-cases an upper-case prefix', () => {
    const cloid = generateCloid('A99A', (length) => '0'.repeat(length))
    expect(cloid.startsWith('0xa99a')).toBe(true)
  })

  it('fills the remainder from the injected randomness source', () => {
    const cloid = generateCloid('a99a', (length) => 'f'.repeat(length))
    expect(cloid).toBe(`0xa99a${'f'.repeat(28)}`)
  })

  it('truncates to 32 hex chars when the prefix is over-long', () => {
    const longPrefix = 'b'.repeat(40)
    const cloid = generateCloid(longPrefix)
    expect(cloid).toMatch(CLOID_PATTERN)
  })

  it('produces distinct cloids across calls with the default randomness', () => {
    const first = generateCloid('a99a')
    const second = generateCloid('a99a')
    expect(first).not.toBe(second)
  })
})
