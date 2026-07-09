import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { StatusCodes } from 'http-status-codes'
import { createApiClient } from '@/modules/shared/http'
import { importWallet } from '../import-wallet'
import { removeWallet } from '../remove-wallet'

const NATIVE = '0xaaaa000000000000000000000000000000000001'
const IMPORTED = '0xbbbb000000000000000000000000000000000002'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const client = createApiClient({ getAccessToken: async () => 'jwt' })

function meWith(imported: boolean) {
  return {
    user: { privyId: 'did:privy:abc', email: 'a@b.co', handle: 'abc', iconUrl: null },
    wallets: imported
      ? [
          { chain: 'evm', address: NATIVE, isSelected: true, source: 'embedded' },
          { chain: 'evm', address: IMPORTED, isSelected: false, source: 'external' },
        ]
      : [{ chain: 'evm', address: NATIVE, isSelected: true, source: 'embedded' }],
  }
}

describe('importWallet', () => {
  it('posts { address, source } (defaulting source to external) and returns Me on 200', async () => {
    server.use(
      http.post('/api/account/wallets/import', async ({ request }) => {
        const body = (await request.json()) as { address: string; source: string }
        expect(body).toEqual({ address: IMPORTED, source: 'external' })
        return HttpResponse.json(meWith(true))
      }),
    )
    const result = await importWallet(client, IMPORTED)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.wallets.some((w) => w.address === IMPORTED)).toBe(true)
    }
  })

  it('posts source: imported for a raw-key import (ADR-0076 D-6)', async () => {
    server.use(
      http.post('/api/account/wallets/import', async ({ request }) => {
        const body = (await request.json()) as { address: string; source: string }
        expect(body).toEqual({ address: IMPORTED, source: 'imported' })
        return HttpResponse.json(meWith(true))
      }),
    )
    const result = await importWallet(client, IMPORTED, 'imported')
    expect(result.isOk()).toBe(true)
  })

  it('surfaces a 409 WALLET_CAP_REACHED as an ApiError', async () => {
    server.use(
      http.post('/api/account/wallets/import', () =>
        HttpResponse.json(
          { error: { code: 'WALLET_CAP_REACHED' } },
          { status: StatusCodes.CONFLICT },
        ),
      ),
    )
    const result = await importWallet(client, IMPORTED)
    expect(result.isErr()).toBe(true)
    if (result.isErr() && result.error.kind === 'api') {
      expect(result.error.status).toBe(StatusCodes.CONFLICT)
    }
  })
})

describe('removeWallet', () => {
  it('issues a DELETE to the address path and returns the updated Me on 200', async () => {
    server.use(
      http.delete('/api/account/wallets/:address', ({ params }) => {
        expect(params.address).toBe(IMPORTED)
        return HttpResponse.json(meWith(false))
      }),
    )
    const result = await removeWallet(client, IMPORTED)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.wallets.some((w) => w.address === IMPORTED)).toBe(false)
    }
  })

  it('surfaces a 403 FORBIDDEN as an ApiError', async () => {
    server.use(
      http.delete('/api/account/wallets/:address', () =>
        HttpResponse.json({ error: { code: 'FORBIDDEN' } }, { status: StatusCodes.FORBIDDEN }),
      ),
    )
    const result = await removeWallet(client, NATIVE)
    expect(result.isErr()).toBe(true)
    if (result.isErr() && result.error.kind === 'api') {
      expect(result.error.status).toBe(StatusCodes.FORBIDDEN)
    }
  })
})
