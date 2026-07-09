import { describe, it, expect } from 'vitest'
import { ApiError, NetworkError } from '../errors'
import { describeHttpError, requestIdFrom } from '../http.utils'

describe('requestIdFrom', () => {
  it('reads the requestId off a raw ApiError', () => {
    const error = new ApiError(500, '/api/x', { error: {} }, 'req-1')
    expect(requestIdFrom(error)).toBe('req-1')
  })

  it('digs one level into a domain error that wraps an ApiError in .cause', () => {
    const wrapped = { kind: 'server', cause: new ApiError(500, '/api/x', null, 'req-2') }
    expect(requestIdFrom(wrapped)).toBe('req-2')
  })

  it('returns undefined for a failure that never reached the server', () => {
    expect(requestIdFrom(new NetworkError('offline', null))).toBeUndefined()
    expect(requestIdFrom({ kind: 'server', cause: new Error('venue') })).toBeUndefined()
    expect(requestIdFrom(undefined)).toBeUndefined()
    expect(requestIdFrom('nope')).toBeUndefined()
  })

  it('returns undefined when the ApiError carried no requestId', () => {
    expect(requestIdFrom(new ApiError(500, '/api/x', null))).toBeUndefined()
  })
})

describe('describeHttpError', () => {
  it('expands an ApiError into kind + status + requestId', () => {
    const error = new ApiError(422, '/api/x', { error: {} }, 'req-3')
    expect(describeHttpError(error)).toEqual({
      kind: 'api',
      status: 422,
      requestId: 'req-3',
    })
  })

  it('reduces a non-api HttpError to just its kind, never the body', () => {
    expect(describeHttpError(new NetworkError('offline', null))).toEqual({
      kind: 'network',
    })
  })
})
