import { describe, it, expect, vi } from 'vitest'
import { createLogger } from '../create-logger'
import type { LogFields, LoggerAdapter } from '../logger.types'

interface CapturedRecord {
  level: 'debug' | 'info' | 'warn' | 'error'
  fields: LogFields
  message: string
}

function buildCapturingAdapter(): {
  adapter: LoggerAdapter
  records: CapturedRecord[]
} {
  const records: CapturedRecord[] = []
  const adapter: LoggerAdapter = {
    debug: (fields, message) => records.push({ level: 'debug', fields, message }),
    info: (fields, message) => records.push({ level: 'info', fields, message }),
    warn: (fields, message) => records.push({ level: 'warn', fields, message }),
    error: (fields, message) => records.push({ level: 'error', fields, message }),
  }
  return { adapter, records }
}

describe('createLogger', () => {
  describe('level filter', () => {
    it('drops records below the configured threshold before they reach the adapter', () => {
      const { adapter, records } = buildCapturingAdapter()
      const logger = createLogger({ level: 'warn', adapter })

      logger.debug({}, 'debug')
      logger.info({}, 'info')
      logger.warn({}, 'warn')
      logger.error({}, 'error')

      expect(records.map((r) => r.level)).toEqual(['warn', 'error'])
    })

    it('passes every level when threshold is debug', () => {
      const { adapter, records } = buildCapturingAdapter()
      const logger = createLogger({ level: 'debug', adapter })

      logger.debug({}, 'a')
      logger.info({}, 'b')
      logger.warn({}, 'c')
      logger.error({}, 'd')

      expect(records).toHaveLength(4)
    })

    it('does not invoke the adapter at all when filtered', () => {
      const adapter: LoggerAdapter = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }
      const logger = createLogger({ level: 'error', adapter })

      logger.debug({}, 'x')
      logger.info({}, 'x')
      logger.warn({}, 'x')

      expect(adapter.debug).not.toHaveBeenCalled()
      expect(adapter.info).not.toHaveBeenCalled()
      expect(adapter.warn).not.toHaveBeenCalled()
    })
  })

  describe('child()', () => {
    it('pre-bound fields appear on every emitted record', () => {
      const { adapter, records } = buildCapturingAdapter()
      const logger = createLogger({ level: 'debug', adapter }).child({
        module: 'test-module',
      })

      logger.info({ a: 1 }, 'm1')
      logger.warn({ b: 2 }, 'm2')

      expect(records[0].fields).toEqual({ module: 'test-module', a: 1 })
      expect(records[1].fields).toEqual({ module: 'test-module', b: 2 })
    })

    it('call-site fields win on key collision', () => {
      const { adapter, records } = buildCapturingAdapter()
      const logger = createLogger({ level: 'debug', adapter }).child({
        module: 'bound',
        shared: 'parent',
      })

      logger.info({ shared: 'callsite' }, 'm')

      expect(records[0].fields).toEqual({
        module: 'bound',
        shared: 'callsite',
      })
    })

    it('chained child().child() merges all layers, with later layers winning over earlier', () => {
      const { adapter, records } = buildCapturingAdapter()
      const logger = createLogger({ level: 'debug', adapter })
        .child({ module: 'outer', level: 1 })
        .child({ scope: 'inner', level: 2 })

      logger.info({ extra: true }, 'm')

      expect(records[0].fields).toEqual({
        module: 'outer',
        scope: 'inner',
        level: 2,
        extra: true,
      })
    })

    it('call-site still wins after chained children', () => {
      const { adapter, records } = buildCapturingAdapter()
      const logger = createLogger({ level: 'debug', adapter })
        .child({ module: 'outer' })
        .child({ scope: 'inner' })

      logger.info({ module: 'callsite' }, 'm')

      expect(records[0].fields.module).toBe('callsite')
      expect(records[0].fields.scope).toBe('inner')
    })

    it('inherits the level threshold from the parent', () => {
      const { adapter, records } = buildCapturingAdapter()
      const child = createLogger({ level: 'warn', adapter }).child({ module: 'm' })

      child.debug({}, 'd')
      child.info({}, 'i')
      child.warn({}, 'w')

      expect(records.map((r) => r.level)).toEqual(['warn'])
    })
  })

  it('routes each level to the matching adapter method with merged fields and message', () => {
    const { adapter, records } = buildCapturingAdapter()
    const logger = createLogger({ level: 'debug', adapter })

    logger.debug({ a: 1 }, 'd-msg')
    logger.info({ a: 2 }, 'i-msg')
    logger.warn({ a: 3 }, 'w-msg')
    logger.error({ a: 4 }, 'e-msg')

    expect(records).toEqual([
      { level: 'debug', fields: { a: 1 }, message: 'd-msg' },
      { level: 'info', fields: { a: 2 }, message: 'i-msg' },
      { level: 'warn', fields: { a: 3 }, message: 'w-msg' },
      { level: 'error', fields: { a: 4 }, message: 'e-msg' },
    ])
  })
})
