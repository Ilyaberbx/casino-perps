import { describe, it, expect, vi } from 'vitest'
import { MultiLoggerAdapter } from '../multi-logger-adapter'
import type { LogFields, LoggerAdapter } from '../../logger.types'

interface CapturedRecord {
  source: string
  level: 'debug' | 'info' | 'warn' | 'error'
  fields: LogFields
  message: string
}

function buildCapturingAdapter(
  source: string,
  records: CapturedRecord[],
): LoggerAdapter {
  return {
    debug: (fields, message) => records.push({ source, level: 'debug', fields, message }),
    info: (fields, message) => records.push({ source, level: 'info', fields, message }),
    warn: (fields, message) => records.push({ source, level: 'warn', fields, message }),
    error: (fields, message) => records.push({ source, level: 'error', fields, message }),
  }
}

describe('MultiLoggerAdapter', () => {
  it('fans out each level to every configured adapter', () => {
    const records: CapturedRecord[] = []
    const a = buildCapturingAdapter('a', records)
    const b = buildCapturingAdapter('b', records)
    const multi = MultiLoggerAdapter([a, b])

    multi.debug({ k: 1 }, 'd')
    multi.info({ k: 2 }, 'i')
    multi.warn({ k: 3 }, 'w')
    multi.error({ k: 4 }, 'e')

    expect(records).toHaveLength(8)
    expect(records.filter((r) => r.source === 'a').map((r) => r.level)).toEqual([
      'debug', 'info', 'warn', 'error',
    ])
    expect(records.filter((r) => r.source === 'b').map((r) => r.level)).toEqual([
      'debug', 'info', 'warn', 'error',
    ])
  })

  it('preserves registration order when fanning out', () => {
    const records: CapturedRecord[] = []
    const first = buildCapturingAdapter('first', records)
    const second = buildCapturingAdapter('second', records)
    const third = buildCapturingAdapter('third', records)
    const multi = MultiLoggerAdapter([first, second, third])

    multi.info({}, 'm')

    expect(records.map((r) => r.source)).toEqual(['first', 'second', 'third'])
  })

  it('isolates per-adapter failures: a throwing adapter does not stop the others', () => {
    const records: CapturedRecord[] = []
    const broken: LoggerAdapter = {
      debug: () => { throw new Error('boom') },
      info: () => { throw new Error('boom') },
      warn: () => { throw new Error('boom') },
      error: () => { throw new Error('boom') },
    }
    const ok = buildCapturingAdapter('ok', records)
    const multi = MultiLoggerAdapter([broken, ok])

    expect(() => multi.info({}, 'still works')).not.toThrow()
    expect(() => multi.warn({}, 'still works')).not.toThrow()

    expect(records).toEqual([
      { source: 'ok', level: 'info', fields: {}, message: 'still works' },
      { source: 'ok', level: 'warn', fields: {}, message: 'still works' },
    ])
  })

  it('isolates a throwing adapter even when it sits between two healthy adapters', () => {
    const records: CapturedRecord[] = []
    const a = buildCapturingAdapter('a', records)
    const broken: LoggerAdapter = {
      debug: vi.fn(() => { throw new Error('x') }),
      info: vi.fn(() => { throw new Error('x') }),
      warn: vi.fn(() => { throw new Error('x') }),
      error: vi.fn(() => { throw new Error('x') }),
    }
    const c = buildCapturingAdapter('c', records)
    const multi = MultiLoggerAdapter([a, broken, c])

    multi.error({}, 'm')

    expect(records.map((r) => r.source)).toEqual(['a', 'c'])
    expect(broken.error).toHaveBeenCalledTimes(1)
  })

  it('with zero adapters, does nothing and does not throw', () => {
    const multi = MultiLoggerAdapter([])
    expect(() => {
      multi.debug({}, 'd')
      multi.info({}, 'i')
      multi.warn({}, 'w')
      multi.error({}, 'e')
    }).not.toThrow()
  })
})
