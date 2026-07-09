// Env-derived runtime config for the account module (NOT a constant — see
// frontend-architecture.md: env-derived values live in *.config.ts).
//
// DEV-ONLY MOCK-AUTH SEAM (ADR-0055). Headless Playwright can't complete
// Privy's interactive login, so the wallet-connected gate
// (`useIsWalletConnected()` = ready && authenticated && walletReady) never
// flips true and the FitCell tables / Spectate Mode never mount. This resolver
// decides whether the app should run in mock-auth mode: it returns a mock
// config (a connected wallet) ONLY when BOTH `import.meta.env.DEV` is true AND
// `VITE_MOCK_AUTH === 'true'`. In any production build `DEV` is false, so the
// resolver returns null and Vite dead-code-eliminates the entire mock branch in
// `AuthProvider` (the `if (mockAuthConfig)` guard becomes `if (null)`).
//
// This is a narrow dev seam inside `account/`, NOT a new AccountAdapter port —
// see ADR-0004 (account stays openly Privy-coupled). The mock only flips the
// connected gate; the spectated address from `?spectate=` overrides the
// viewing address downstream.

import { parseWalletAddress } from '@/modules/shared/domain'
import type { MockAuthConfig, MockAuthEnv } from './account.types'

// An obviously-fake placeholder address used when no override is supplied.
// Checksummed so `parseWalletAddress` accepts it without re-casing.
const DEFAULT_MOCK_WALLET_ADDRESS = '0x000000000000000000000000000000000000dEaD'

/**
 * Resolve the dev-only mock-auth config, or `null` to use the real Privy path.
 *
 * Returns a config **only** when `env.DEV === true` AND
 * `env.VITE_MOCK_AUTH === 'true'` — every other combination (flag unset, empty,
 * `'false'`, any truthy-but-not-`'true'` value, or a production build) resolves
 * `null`. An explicit `VITE_MOCK_AUTH_ADDRESS` overrides the placeholder; a
 * malformed override falls back to the default rather than crashing.
 */
export function resolveMockAuthConfig(env: MockAuthEnv): MockAuthConfig | null {
  const isDevBuild = env.DEV === true
  const isFlagEnabled = env.VITE_MOCK_AUTH === 'true'
  const isMockAuthEnabled = isDevBuild && isFlagEnabled
  if (!isMockAuthEnabled) return null

  const override = env.VITE_MOCK_AUTH_ADDRESS
  const hasOverride = override !== undefined && override !== ''
  const isOverrideValid = hasOverride && parseWalletAddress(override).isOk()
  const walletAddress = isOverrideValid ? override : DEFAULT_MOCK_WALLET_ADDRESS

  return { walletAddress }
}
