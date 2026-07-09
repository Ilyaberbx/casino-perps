import { AuthContext } from './auth-provider.context'
import type { AuthValueProviderProps } from './auth-provider.types'
import { useAuthValue } from './use-auth-value'

export type { AuthValueProviderProps } from './auth-provider.types'

// `AuthValueProvider` is the inner component that publishes the `AuthState`
// through `AuthContext`. All state, effects, handler-wrapping, and derivation
// live in the `useAuthValue` smart hook (smart-hook + dumb-component pattern);
// this component is a thin Provider wrapper. It is NOT part of the module's
// public API — only the test fixture (`__fixtures__/auth-bridge-for-test.tsx`)
// re-exports it for tests that need to drive auth state without running
// PrivyProvider.
export function AuthValueProvider({ children, ...input }: AuthValueProviderProps) {
  const value = useAuthValue(input)
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
