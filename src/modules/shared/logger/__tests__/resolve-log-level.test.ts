import { describe, it, expect } from 'vitest'
import { resolveLogLevel } from '../resolve-log-level'

describe('resolveLogLevel', () => {
  describe('no override set', () => {
    it('defaults to debug in dev', () => {
      expect(resolveLogLevel(undefined, true)).toEqual({
        level: 'debug',
        invalidRaw: null,
      })
    })

    it('defaults to info outside dev', () => {
      expect(resolveLogLevel(undefined, false)).toEqual({
        level: 'info',
        invalidRaw: null,
      })
    })

    it('treats an empty string as unset', () => {
      expect(resolveLogLevel('', true)).toEqual({
        level: 'debug',
        invalidRaw: null,
      })
    })
  })

  describe('valid override', () => {
    it('wins over the default and can raise the dev floor to warn', () => {
      expect(resolveLogLevel('warn', true)).toEqual({
        level: 'warn',
        invalidRaw: null,
      })
    })

    it('wins over the default and can lower the prod floor to debug', () => {
      expect(resolveLogLevel('debug', false)).toEqual({
        level: 'debug',
        invalidRaw: null,
      })
    })

    it('accepts every supported level', () => {
      const levels = ['debug', 'info', 'warn', 'error'] as const
      for (const level of levels) {
        expect(resolveLogLevel(level, true)).toEqual({ level, invalidRaw: null })
      }
    })
  })

  describe('invalid override', () => {
    it('falls back to the dev default and reports the raw value', () => {
      expect(resolveLogLevel('trace', true)).toEqual({
        level: 'debug',
        invalidRaw: 'trace',
      })
    })

    it('falls back to the prod default and reports the raw value', () => {
      expect(resolveLogLevel('verbose', false)).toEqual({
        level: 'info',
        invalidRaw: 'verbose',
      })
    })
  })
})
