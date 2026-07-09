import { describe, it, expect } from 'vitest'
import { ApiError } from '@/modules/shared/http'
import { buildErrorReport, normalizeError, toLogFields } from '../error-boundary.utils'

describe('normalizeError', () => {
  it('reduces an Error to name/message/stack', () => {
    const error = new TypeError('boom')
    const result = normalizeError(error)
    expect(result.name).toBe('TypeError')
    expect(result.message).toBe('boom')
    expect(result.stack).toContain('boom')
    expect(result.requestId).toBeUndefined()
  })

  it('pulls the correlation id off an ApiError', () => {
    const error = new ApiError(500, '/api/me', { message: 'nope' }, 'req-abc-123')
    const result = normalizeError(error)
    expect(result.requestId).toBe('req-abc-123')
  })

  it('handles a React Router route-error response shape', () => {
    const result = normalizeError({ status: 404, statusText: 'Not Found', data: null })
    expect(result.name).toBe('HTTP 404')
    expect(result.message).toBe('Not Found')
  })

  it('handles a bare string throw', () => {
    expect(normalizeError('plain failure').message).toBe('plain failure')
  })

  it('handles a non-serializable object throw without crashing', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const result = normalizeError(circular)
    expect(result.name).toBe('Error')
    expect(typeof result.message).toBe('string')
  })
})

describe('toLogFields', () => {
  it('omits requestId when absent', () => {
    expect(toLogFields({ name: 'Error', message: 'x' })).toEqual({
      errorName: 'Error',
      errorMessage: 'x',
    })
  })

  it('includes requestId when present', () => {
    const fields = toLogFields({ name: 'Error', message: 'x', requestId: 'req-1' })
    expect(fields.requestId).toBe('req-1')
  })
})

describe('buildErrorReport', () => {
  it('includes the where/time/error lines and the stack', () => {
    const report = buildErrorReport({
      name: 'TypeError',
      message: 'boom',
      stack: 'TypeError: boom\n  at x',
      requestId: 'req-9',
      url: 'https://app.test/trade',
      userAgent: 'jsdom',
      timestamp: '2026-07-02T00:00:00.000Z',
    })
    expect(report).toContain('Where: https://app.test/trade')
    expect(report).toContain('Request ID: req-9')
    expect(report).toContain('Error: TypeError: boom')
    expect(report).toContain('Stack:')
  })

  it('drops the request-id and stack lines when they are absent', () => {
    const report = buildErrorReport({
      name: 'Error',
      message: 'x',
      url: 'https://app.test/',
      userAgent: 'jsdom',
      timestamp: '2026-07-02T00:00:00.000Z',
    })
    expect(report).not.toContain('Request ID')
    expect(report).not.toContain('Stack:')
  })
})
