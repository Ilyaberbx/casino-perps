import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { StatusCodes } from 'http-status-codes'
import { createApiClient } from '@/modules/shared/http'
import { checkHandleAvailable } from '../check-handle-available'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const client = createApiClient({ getAccessToken: async () => 'jwt' })

describe('checkHandleAvailable', () => {
  it('returns { available } on 200', async () => {
    server.use(
      http.get('/api/account/handle-available', () =>
        HttpResponse.json({ available: true }),
      ),
    )
    const result = await checkHandleAvailable(client, 'satoshi')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toEqual({ available: true })
  })

  it('surfaces a 400 INVALID_REQUEST as an ApiError (NOT available:false)', async () => {
    server.use(
      http.get('/api/account/handle-available', () =>
        HttpResponse.json(
          { error: { code: 'INVALID_REQUEST', issues: { handle: 'bad' } } },
          { status: StatusCodes.BAD_REQUEST },
        ),
      ),
    )
    const result = await checkHandleAvailable(client, '!!')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.kind).toBe('api')
      if (result.error.kind === 'api')
        expect(result.error.status).toBe(StatusCodes.BAD_REQUEST)
    }
  })
})
