import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { StatusCodes } from 'http-status-codes'
import { createApiClient } from '@/modules/shared/http'
import { AppConfigProvider } from '../AppConfigProvider'
import { useAppConfig } from '../use-app-config'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const client = createApiClient({ getAccessToken: async () => 'jwt' })

function wrap(enabled: boolean) {
  return ({ children }: { children: ReactNode }) => (
    <AppConfigProvider apiClient={client} enabled={enabled}>
      {children}
    </AppConfigProvider>
  )
}

describe('AppConfigProvider / useAppConfig', () => {
  it('reflects the fetched flag when the gate is disabled server-side', async () => {
    server.use(
      http.get('/api/config', () => HttpResponse.json({ inviteGateEnabled: false })),
    )
    const { result } = renderHook(() => useAppConfig(), { wrapper: wrap(true) })
    await waitFor(() => expect(result.current.inviteGateEnabled).toBe(false))
  })

  it('keeps the gate enabled (fail-safe) when the fetch errors', async () => {
    server.use(
      http.get('/api/config', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL' } },
          { status: StatusCodes.INTERNAL_SERVER_ERROR },
        ),
      ),
    )
    const { result } = renderHook(() => useAppConfig(), { wrapper: wrap(true) })
    // Give the failed fetch a tick; the value must remain the fail-safe default.
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.inviteGateEnabled).toBe(true)
  })

  it('does not fetch when disabled, defaulting to gate-enabled', async () => {
    // No handler registered → onUnhandledRequest:'error' would throw if it fetched.
    const { result } = renderHook(() => useAppConfig(), { wrapper: wrap(false) })
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.inviteGateEnabled).toBe(true)
  })
})
