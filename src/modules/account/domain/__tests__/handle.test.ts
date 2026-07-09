import { describe, it, expect } from 'vitest'
import { handleSchema, parseHandle } from '../handle'

describe('handleSchema (client mirror of server)', () => {
  it('lowercases a valid handle', () => {
    const parsed = handleSchema.safeParse('Satoshi_1')
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data).toBe('satoshi_1')
  })

  it('rejects handles shorter than 3 characters', () => {
    const parsed = handleSchema.safeParse('ab')
    expect(parsed.success).toBe(false)
    if (!parsed.success)
      expect(parsed.error.issues[0].message).toBe(
        'Handle must be at least 3 characters',
      )
  })

  it('rejects handles longer than 50 characters', () => {
    const parsed = handleSchema.safeParse('a'.repeat(51))
    expect(parsed.success).toBe(false)
    if (!parsed.success)
      expect(parsed.error.issues[0].message).toBe(
        'Handle must be at most 50 characters',
      )
  })

  it('rejects illegal characters', () => {
    const parsed = handleSchema.safeParse('bad handle!')
    expect(parsed.success).toBe(false)
    if (!parsed.success)
      expect(parsed.error.issues[0].message).toBe(
        'Handle can only contain letters, numbers, underscores, and hyphens',
      )
  })
})

describe('parseHandle', () => {
  it('returns the normalised handle on success', () => {
    const result = parseHandle('Foo-Bar')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toBe('foo-bar')
  })

  it('returns the first format issue message on failure', () => {
    const result = parseHandle('!!')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(typeof result.error).toBe('string')
  })
})
