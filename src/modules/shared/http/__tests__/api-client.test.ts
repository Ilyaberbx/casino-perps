import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import axios from 'axios'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { StatusCodes } from 'http-status-codes'
import { createApiClient } from '../api-client'
import { SessionExpiredError, ApiError, NetworkError } from '../errors'
import { HTTP_REQUEST_TIMEOUT_MS } from '../http.constants'

const BASE = 'http://api.test'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('apiClient', () => {
  it('attaches Authorization: Bearer <token> from getAccessToken on every call', async () => {
    const seenAuth: string[] = []
    server.use(
      http.get(`${BASE}/api/account/me-stub`, ({ request }) => {
        seenAuth.push(request.headers.get('authorization') ?? '')
        return HttpResponse.json({ ok: true })
      }),
    )
    const getAccessToken = vi.fn().mockResolvedValue('jwt-1')
    const client = createApiClient({ getAccessToken, baseUrl: BASE })

    const result = await client.get('/api/account/me-stub')

    expect(result.isOk()).toBe(true)
    expect(getAccessToken).toHaveBeenCalledTimes(1)
    expect(seenAuth[0]).toBe('Bearer jwt-1')
  })

  it('returns NetworkError when no access token is available', async () => {
    const getAccessToken = vi.fn().mockResolvedValue(null)
    const client = createApiClient({ getAccessToken, baseUrl: BASE })
    const result = await client.get('/api/account/me-stub')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(NetworkError)
      expect(result.error.message).toMatch(/access token/i)
    }
  })

  it('configures the axios transport with a request timeout', () => {
    // The timeout is what stops a hung/cold backend from leaving a request
    // pending forever; assert it is wired (the value lives in http.constants).
    const createSpy = vi.spyOn(axios, 'create')
    createApiClient({ getAccessToken: async () => 'jwt', baseUrl: BASE })
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: HTTP_REQUEST_TIMEOUT_MS }),
    )
    createSpy.mockRestore()
  })

  it('maps a transport error (the timeout/abort class) to NetworkError', async () => {
    // An axios timeout rejects with an AxiosError just like any transport
    // failure; `HttpResponse.error()` simulates that class deterministically and
    // proves `sendOnce`'s catch maps it to NetworkError.
    server.use(http.get(`${BASE}/api/boom`, () => HttpResponse.error()))
    const client = createApiClient({
      getAccessToken: async () => 'jwt',
      baseUrl: BASE,
    })

    const result = await client.get('/api/boom')

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(NetworkError)
    }
  })

  it('parses JSON response body', async () => {
    server.use(
      http.get(`${BASE}/api/account/me-stub`, () =>
        HttpResponse.json({ privyId: 'did:privy:abc' }),
      ),
    )
    const client = createApiClient({
      getAccessToken: async () => 'jwt',
      baseUrl: BASE,
    })
    const result = await client.get<{ privyId: string }>('/api/account/me-stub')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({ privyId: 'did:privy:abc' })
  })

  it('propagates non-401 errors as ApiError without retry', async () => {
    let calls = 0
    server.use(
      http.get(`${BASE}/api/account/me-stub`, () => {
        calls += 1
        return new HttpResponse('boom', { status: StatusCodes.INTERNAL_SERVER_ERROR })
      }),
    )
    const getAccessToken = vi.fn().mockResolvedValue('jwt')
    const client = createApiClient({ getAccessToken, baseUrl: BASE })
    const result = await client.get('/api/account/me-stub')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ApiError)
    }
    expect(calls).toBe(1)
    expect(getAccessToken).toHaveBeenCalledTimes(1)
  })

  it('captures the server x-request-id onto ApiError for failed requests', async () => {
    server.use(
      http.get(`${BASE}/api/account/me-stub`, () =>
        new HttpResponse('boom', {
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          headers: { 'x-request-id': 'req-9f2c' },
        }),
      ),
    )
    const client = createApiClient({ getAccessToken: async () => 'jwt', baseUrl: BASE })
    const result = await client.get('/api/account/me-stub')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ApiError)
      if (result.error instanceof ApiError) {
        expect(result.error.requestId).toBe('req-9f2c')
      }
    }
  })

  it('leaves ApiError.requestId undefined when the server omits the header', async () => {
    server.use(
      http.get(`${BASE}/api/account/me-stub`, () =>
        new HttpResponse('boom', { status: StatusCodes.INTERNAL_SERVER_ERROR }),
      ),
    )
    const client = createApiClient({ getAccessToken: async () => 'jwt', baseUrl: BASE })
    const result = await client.get('/api/account/me-stub')
    expect(result.isErr()).toBe(true)
    if (result.isErr() && result.error instanceof ApiError) {
      expect(result.error.requestId).toBeUndefined()
    }
  })

  it('on 401, retries once with a freshly fetched access token', async () => {
    const seenAuth: string[] = []
    let calls = 0
    server.use(
      http.get(`${BASE}/api/account/me-stub`, ({ request }) => {
        seenAuth.push(request.headers.get('authorization') ?? '')
        calls += 1
        if (calls === 1) {
          return new HttpResponse('expired', { status: StatusCodes.UNAUTHORIZED })
        }
        return HttpResponse.json({ ok: true })
      }),
    )
    const getAccessToken = vi
      .fn()
      .mockResolvedValueOnce('jwt-old')
      .mockResolvedValueOnce('jwt-new')
    const client = createApiClient({ getAccessToken, baseUrl: BASE })

    const result = await client.get<{ ok: boolean }>('/api/account/me-stub')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({ ok: true })
    expect(getAccessToken).toHaveBeenCalledTimes(2)
    expect(calls).toBe(2)
    expect(seenAuth[0]).toBe('Bearer jwt-old')
    expect(seenAuth[1]).toBe('Bearer jwt-new')
  })

  it('on a second 401, returns SessionExpiredError and does not retry further', async () => {
    let calls = 0
    server.use(
      http.get(`${BASE}/api/account/me-stub`, () => {
        calls += 1
        return new HttpResponse('expired', { status: StatusCodes.UNAUTHORIZED })
      }),
    )
    const getAccessToken = vi
      .fn()
      .mockResolvedValueOnce('jwt-old')
      .mockResolvedValueOnce('jwt-new')
    const client = createApiClient({ getAccessToken, baseUrl: BASE })

    const result = await client.get('/api/account/me-stub')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(SessionExpiredError)
    }
    expect(calls).toBe(2)
  })

  it('non-idempotent POST is not double-applied: token-expiry 401 rejects before the controller', async () => {
    const seenBodies: string[] = []
    let calls = 0
    server.use(
      http.post(`${BASE}/api/x`, async ({ request }) => {
        seenBodies.push(await request.text())
        calls += 1
        if (calls === 1) {
          return new HttpResponse('expired', { status: StatusCodes.UNAUTHORIZED })
        }
        return HttpResponse.json({ created: true })
      }),
    )
    const getAccessToken = vi
      .fn()
      .mockResolvedValueOnce('jwt-old')
      .mockResolvedValueOnce('jwt-new')
    const client = createApiClient({ getAccessToken, baseUrl: BASE })

    const result = await client.post<{ created: boolean }>('/api/x', { a: 1 })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({ created: true })
    expect(calls).toBe(2)
    expect(seenBodies[1]).toBe(JSON.stringify({ a: 1 }))
  })

  it('notifies session-expired subscribers on second 401', async () => {
    server.use(
      http.get(`${BASE}/api/account/me-stub`, () =>
        new HttpResponse('expired', { status: StatusCodes.UNAUTHORIZED }),
      ),
    )
    const getAccessToken = vi
      .fn()
      .mockResolvedValueOnce('jwt-old')
      .mockResolvedValueOnce('jwt-new')
      .mockResolvedValueOnce('jwt-old')
      .mockResolvedValueOnce('jwt-new')
    const client = createApiClient({ getAccessToken, baseUrl: BASE })

    const handler = vi.fn()
    const unsubscribe = client.subscribeToSessionExpired(handler)

    const result1 = await client.get('/api/account/me-stub')
    expect(result1.isErr()).toBe(true)
    if (result1.isErr()) {
      expect(result1.error).toBeInstanceOf(SessionExpiredError)
    }
    expect(handler).toHaveBeenCalledTimes(1)

    unsubscribe()
    const result2 = await client.get('/api/account/me-stub')
    expect(result2.isErr()).toBe(true)
    if (result2.isErr()) {
      expect(result2.error).toBeInstanceOf(SessionExpiredError)
    }
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
