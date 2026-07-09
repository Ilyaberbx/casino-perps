// Module-scoped types for the account module.

/**
 * The subset of `import.meta.env` the dev-only mock-auth resolver reads. Passed
 * in explicitly (not read from the global) so `resolveMockAuthConfig` stays a
 * pure, unit-testable function — tests inject a literal env instead of mutating
 * `import.meta.env`.
 */
export interface MockAuthEnv {
  readonly DEV: boolean
  readonly VITE_MOCK_AUTH?: string
  readonly VITE_MOCK_AUTH_ADDRESS?: string
}

/**
 * Resolved dev-only mock-auth config. Presence (non-null) means the app should
 * short-circuit Privy and report a connected mock wallet; see ADR-0055.
 */
export interface MockAuthConfig {
  /** The placeholder (or env-overridden) connected wallet address. */
  readonly walletAddress: string
}
