import { describe, it, expect } from 'vitest'
import { StatusCodes } from 'http-status-codes'
import { ApiError, NetworkError, ParseError, SessionExpiredError } from '@/modules/shared/http'
import { inviteErrorFrom, submitErrorToast } from '../onboarding-stepper.utils'

const PATH = '/api/account/onboard'

function apiErrorWith(body: unknown, status = StatusCodes.BAD_REQUEST): ApiError {
  return new ApiError(status, PATH, body)
}

describe('inviteErrorFrom', () => {
  it('maps the two invite codes to inline copy', () => {
    expect(inviteErrorFrom(apiErrorWith({ error: { code: 'INVALID_INVITE_CODE' } }))).toBe(
      'Invalid invite code',
    )
    expect(
      inviteErrorFrom(apiErrorWith({ error: { code: 'INVITE_CODE_ALREADY_REDEEMED' } })),
    ).toBe('Invite code already used')
  })

  it('maps a malformed invite code (issues.inviteCode) to the invalid message', () => {
    const body = { error: { code: 'INVALID_REQUEST', issues: { inviteCode: 'bad format' } } }
    expect(inviteErrorFrom(apiErrorWith(body, StatusCodes.BAD_REQUEST))).toBe('Invalid invite code')
  })

  it('ignores a malformed handle (issues.handle, no inviteCode)', () => {
    const body = { error: { code: 'INVALID_REQUEST', issues: { handle: 'too short' } } }
    expect(inviteErrorFrom(apiErrorWith(body))).toBeNull()
  })

  it('returns null for non-invite and non-API failures', () => {
    expect(inviteErrorFrom(apiErrorWith({ error: { code: 'HANDLE_TAKEN' } }))).toBeNull()
    expect(inviteErrorFrom(new NetworkError('offline', new Error('x')))).toBeNull()
  })
})

describe('submitErrorToast', () => {
  it('keeps the handle-specific copy only for a real HANDLE_TAKEN', () => {
    expect(submitErrorToast(apiErrorWith({ error: { code: 'HANDLE_TAKEN' } }))).toEqual({
      title: 'Could not set handle',
      description: 'That handle may already be taken. Try another.',
    })
  })

  it('surfaces an honest service-unavailable for UPSTREAM_UNAVAILABLE', () => {
    const error = apiErrorWith({ error: { code: 'UPSTREAM_UNAVAILABLE' } }, StatusCodes.BAD_GATEWAY)
    expect(submitErrorToast(error).title).toBe('Service unavailable')
  })

  it('never disguises a 500 / INTERNAL as a taken handle', () => {
    const toast = submitErrorToast(apiErrorWith({ error: { code: 'INTERNAL' } }, StatusCodes.INTERNAL_SERVER_ERROR))
    expect(toast.title).toBe('Could not continue')
  })

  it('maps transport failures (session / network) to honest copy', () => {
    expect(submitErrorToast(new SessionExpiredError(PATH)).title).toBe('Session expired')
    expect(submitErrorToast(new NetworkError('offline', new Error('x'))).title).toBe(
      'Connection problem',
    )
  })

  it('falls back to generic copy for an unreadable (parse) failure', () => {
    expect(submitErrorToast(new ParseError('bad json', new Error('x'))).title).toBe(
      'Could not continue',
    )
  })
})
