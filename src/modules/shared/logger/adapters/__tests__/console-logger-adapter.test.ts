import { describe, it, expect, vi, afterEach } from 'vitest'
import { ConsoleLoggerAdapter } from '../console-logger-adapter'

describe('ConsoleLoggerAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('routes debug to console.debug with (message, fields)', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    ConsoleLoggerAdapter.debug({ a: 1 }, 'd-msg')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('d-msg', { a: 1 })
  })

  it('routes info to console.info with (message, fields)', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    ConsoleLoggerAdapter.info({ a: 2 }, 'i-msg')
    expect(spy).toHaveBeenCalledWith('i-msg', { a: 2 })
  })

  it('routes warn to console.warn with (message, fields)', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    ConsoleLoggerAdapter.warn({ a: 3 }, 'w-msg')
    expect(spy).toHaveBeenCalledWith('w-msg', { a: 3 })
  })

  it('routes error to console.error with (message, fields)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    ConsoleLoggerAdapter.error({ a: 4 }, 'e-msg')
    expect(spy).toHaveBeenCalledWith('e-msg', { a: 4 })
  })

  it('does not stringify the fields object (preserves DevTools object inspection)', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const fields = { nested: { a: 1 } }
    ConsoleLoggerAdapter.info(fields, 'm')
    expect(spy.mock.calls[0][1]).toBe(fields)
  })
})
