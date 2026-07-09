export { AuthProvider } from './AuthProvider'
export { useAuth } from './use-auth'
// Context + state type are exported because app-level routing tests
// (`app/app-shell/__tests__/routing.test.tsx` via `@/modules/account`) drive
// the AuthContext directly with a fixture value, and cross-component test
// wrappers across the account module mount the context by hand.
export { AuthContext, type AuthState } from './auth-provider.context'
