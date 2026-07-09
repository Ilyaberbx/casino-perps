import { describe, it, expect } from 'vitest'
import { resolveMockAuthConfig } from '../account.config'

describe('resolveMockAuthConfig()', () => {
  it('returns a mock config when DEV is true and VITE_MOCK_AUTH === "true"', () => {
    const config = resolveMockAuthConfig({ DEV: true, VITE_MOCK_AUTH: 'true' })
    expect(config).not.toBeNull()
    expect(config?.walletAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('uses an explicit VITE_MOCK_AUTH_ADDRESS when provided', () => {
    const address = '0x000000000000000000000000000000000000dEaD'
    const config = resolveMockAuthConfig({
      DEV: true,
      VITE_MOCK_AUTH: 'true',
      VITE_MOCK_AUTH_ADDRESS: address,
    })
    expect(config?.walletAddress).toBe(address)
  })

  it('returns null (real Privy path) when the flag is off', () => {
    expect(resolveMockAuthConfig({ DEV: true, VITE_MOCK_AUTH: undefined })).toBeNull()
    expect(resolveMockAuthConfig({ DEV: true, VITE_MOCK_AUTH: '' })).toBeNull()
    expect(resolveMockAuthConfig({ DEV: true, VITE_MOCK_AUTH: 'false' })).toBeNull()
    expect(resolveMockAuthConfig({ DEV: true, VITE_MOCK_AUTH: '1' })).toBeNull()
  })

  it('returns null in a non-DEV (production) build even with the flag on', () => {
    expect(resolveMockAuthConfig({ DEV: false, VITE_MOCK_AUTH: 'true' })).toBeNull()
  })

  it('falls back to the default dev address when the override is malformed', () => {
    const config = resolveMockAuthConfig({
      DEV: true,
      VITE_MOCK_AUTH: 'true',
      VITE_MOCK_AUTH_ADDRESS: 'not-an-address',
    })
    expect(config).not.toBeNull()
    expect(config?.walletAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })
})
