import { describe, it, expect } from 'vitest'
import { StatusCodes } from 'http-status-codes'
import { ApiError, NetworkError, ParseError, SessionExpiredError } from '@/modules/shared/http'
import { apiErrorCode, apiErrorIssues, apiErrorMessage, toErrorCopy } from '../api-error-copy'
import { CODE_COPY, KIND_COPY } from '../api-error-copy.constants'

const PATH = '/api/account/onboard'

function apiErrorWith(body: unknown, status = StatusCodes.BAD_REQUEST): ApiError {
  return new ApiError(status, PATH, body)
}

describe('apiErrorCode', () => {
  it('returns the server code from a well-formed envelope', () => {
    expect(apiErrorCode(apiErrorWith({ error: { code: 'HANDLE_TAKEN' } }))).toBe('HANDLE_TAKEN')
  })

  it('returns null for a non-API error', () => {
    expect(apiErrorCode(new NetworkError('offline', new Error('x')))).toBeNull()
    expect(apiErrorCode(new ParseError('bad json', new Error('x')))).toBeNull()
    expect(apiErrorCode(new SessionExpiredError(PATH))).toBeNull()
  })

  it('returns null for a malformed or code-less body', () => {
    expect(apiErrorCode(apiErrorWith({ nope: true }))).toBeNull()
    expect(apiErrorCode(apiErrorWith('not json'))).toBeNull()
    expect(apiErrorCode(apiErrorWith({ error: { message: 'no code here' } }))).toBeNull()
  })
})

describe('apiErrorMessage', () => {
  it('returns the lead message when present', () => {
    expect(apiErrorMessage(apiErrorWith({ error: { message: 'Handle is already taken' } }))).toBe(
      'Handle is already taken',
    )
  })

  it('returns null when absent or non-API', () => {
    expect(apiErrorMessage(apiErrorWith({ error: { code: 'X' } }))).toBeNull()
    expect(apiErrorMessage(new NetworkError('offline', new Error('x')))).toBeNull()
  })
})

describe('apiErrorIssues', () => {
  it('returns the field → message map verbatim', () => {
    const issues = { inviteCode: 'Invalid invite code', handle: 'Too short' }
    expect(apiErrorIssues(apiErrorWith({ error: { code: 'INVALID_REQUEST', issues } }))).toEqual(
      issues,
    )
  })

  it('returns null when the body carries no issues', () => {
    expect(apiErrorIssues(apiErrorWith({ error: { code: 'X' } }))).toBeNull()
    expect(apiErrorIssues(new ParseError('bad', new Error('x')))).toBeNull()
  })
})

describe('toErrorCopy', () => {
  it('maps each transport kind to its fallback copy', () => {
    expect(toErrorCopy(new SessionExpiredError(PATH))).toEqual(KIND_COPY['session-expired'])
    expect(toErrorCopy(new NetworkError('offline', new Error('x')))).toEqual(KIND_COPY.network)
    expect(toErrorCopy(new ParseError('bad', new Error('x')))).toEqual(KIND_COPY.parse)
  })

  it('maps a known cross-cutting server code to its copy', () => {
    const error = apiErrorWith(
      { error: { code: 'UPSTREAM_UNAVAILABLE' } },
      StatusCodes.BAD_GATEWAY,
    )
    expect(toErrorCopy(error)).toEqual(CODE_COPY.UPSTREAM_UNAVAILABLE)
  })

  it('falls back to generic api copy for a module-specific or unknown code', () => {
    // Module-specific codes are intentionally not mapped here — the owning module overrides.
    expect(toErrorCopy(apiErrorWith({ error: { code: 'HANDLE_TAKEN' } }))).toEqual(KIND_COPY.api)
    expect(toErrorCopy(apiErrorWith({ totally: 'malformed' }))).toEqual(KIND_COPY.api)
  })
})
