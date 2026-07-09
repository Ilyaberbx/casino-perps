import { describe, it, expect } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
// `act` wraps the async grant / revoke side-effects so the Result settles.
import { useDelegationConsent } from '../use-delegation-consent'
import {
  buildConsentDeps,
  buildFakeGrantPort,
  FAKE_SCOPE,
  MINARA_RECIPIENT,
  type DelegationSpy,
} from '../__fixtures__/fake-delegation-consent-deps'

describe('useDelegationConsent', () => {
  it('starts not-granted and exposes the scope copy (recipient, cap, expiry)', async () => {
    const { result } = renderHook(() => useDelegationConsent(buildConsentDeps()))

    await waitFor(() => expect(result.current.phase).toBe('idle'))
    expect(result.current.status).toBe('not-granted')
    expect(result.current.isActive).toBe(false)
    // Truncated recipient, USD cap, ISO-8601 expiry date — for display.
    expect(result.current.scope.recipient).toMatch(/^0x5555…5555$/)
    expect(result.current.scope.cap).toBe('$50.00')
    expect(result.current.scope.expiry).toBe('2026-07-12')
  })

  it('grants the scoped delegation and flips status to active', async () => {
    const spy: DelegationSpy = { granted: [], revoked: 0 }
    const { result } = renderHook(() =>
      useDelegationConsent(buildConsentDeps({}, spy)),
    )
    await waitFor(() => expect(result.current.phase).toBe('idle'))

    await act(async () => {
      result.current.grant()
    })

    await waitFor(() => expect(result.current.status).toBe('active'))
    expect(result.current.isActive).toBe(true)
    // The grant went through the seam with the default cap (50) + ttl (30) scope.
    expect(spy.granted).toHaveLength(1)
    expect(spy.granted[0]).toEqual(FAKE_SCOPE)
  })

  it('gates the grant off when the cap is invalid', async () => {
    const { result } = renderHook(() => useDelegationConsent(buildConsentDeps()))
    await waitFor(() => expect(result.current.phase).toBe('idle'))
    expect(result.current.canGrant).toBe(true)

    act(() => result.current.setCapUsd('0'))

    await waitFor(() => expect(result.current.canGrant).toBe(false))
    expect(result.current.capInvalidReason).toContain('Minimum')
  })

  it('grants with the user-chosen cap and ttl, then shows them on the active card', async () => {
    const spy: DelegationSpy = { granted: [], revoked: 0 }
    const { result } = renderHook(() =>
      useDelegationConsent(buildConsentDeps({}, spy)),
    )
    await waitFor(() => expect(result.current.phase).toBe('idle'))

    act(() => {
      result.current.setCapUsd('25')
      result.current.setTtlDays(7)
    })

    // The preview reflects the chosen cap + ttl (7 days after 2026-06-12).
    await waitFor(() => expect(result.current.scope.expiry).toBe('2026-06-19'))
    expect(result.current.scope.cap).toBe('$25.00')

    await act(async () => {
      result.current.grant()
    })

    await waitFor(() => expect(result.current.status).toBe('active'))
    expect(spy.granted[0]).toEqual({
      action: 'usdc-transfer-with-authorization',
      recipient: MINARA_RECIPIENT,
      capUsd: '25.00',
      expiresAt: '2026-06-19T00:00:00.000Z',
    })
    // The active card reflects the just-granted scope.
    expect(result.current.scope.cap).toBe('$25.00')
    expect(result.current.scope.expiry).toBe('2026-06-19')
  })

  it('shows the server-granted cap and expiry when active on load', async () => {
    const { result } = renderHook(() =>
      useDelegationConsent(
        buildConsentDeps({
          initialView: {
            status: 'active',
            appSignerId: 'sig',
            capUsd: '80.00',
            expiresAt: '2026-09-01T00:00:00.000Z',
          },
        }),
      ),
    )
    await waitFor(() => expect(result.current.isActive).toBe(true))
    expect(result.current.scope.cap).toBe('$80.00')
    expect(result.current.scope.expiry).toBe('2026-09-01')
  })

  it('revokes an active delegation and reflects the revoked status', async () => {
    const spy: DelegationSpy = { granted: [], revoked: 0 }
    const { result } = renderHook(() =>
      useDelegationConsent(buildConsentDeps({ initialStatus: 'active' }, spy)),
    )
    await waitFor(() => expect(result.current.status).toBe('active'))

    await act(async () => {
      result.current.revoke()
    })

    await waitFor(() => expect(result.current.status).toBe('revoked'))
    expect(result.current.isActive).toBe(false)
    expect(spy.revoked).toBe(1)
  })

  it('returns non-destructively to idle when the user declines the consent popup', async () => {
    const port = buildFakeGrantPort({ grantFailsWith: 'signer-rejected' })
    const { result } = renderHook(() =>
      useDelegationConsent(buildConsentDeps({ port })),
    )
    await waitFor(() => expect(result.current.phase).toBe('idle'))

    await act(async () => {
      result.current.grant()
    })

    await waitFor(() => expect(result.current.status).toBe('not-granted'))
    expect(result.current.phase).toBe('idle')
    expect(result.current.errorReason).toBeNull()
  })

  it('returns non-destructively to idle when the user declines the revoke popup', async () => {
    const port = buildFakeGrantPort({ revokeFailsWith: 'signer-rejected' })
    const { result } = renderHook(() =>
      useDelegationConsent(buildConsentDeps({ initialStatus: 'active', port })),
    )
    await waitFor(() => expect(result.current.status).toBe('active'))

    await act(async () => {
      result.current.revoke()
    })

    // A declined revoke leaves the delegation active — no error surface.
    await waitFor(() => expect(result.current.phase).toBe('idle'))
    expect(result.current.status).toBe('active')
    expect(result.current.errorReason).toBeNull()
  })

  it('surfaces a server-grant failure as an error reason', async () => {
    const port = buildFakeGrantPort({ grantFailsWith: 'server' })
    const { result } = renderHook(() =>
      useDelegationConsent(buildConsentDeps({ port })),
    )
    await waitFor(() => expect(result.current.phase).toBe('idle'))

    await act(async () => {
      result.current.grant()
    })

    await waitFor(() => expect(result.current.phase).toBe('error'))
    expect(result.current.errorReason).toBe('server')
  })
})
