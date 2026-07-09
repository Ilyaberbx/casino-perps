// Test-only re-export: gives tests a handle on the inner AuthValueProvider
// component that publishes `AuthContext` from already-resolved Privy
// primitives, without spinning up an actual `<PrivyProvider>`. Production
// code does not import this file; only files under `__tests__/` may.
export { AuthValueProvider as AuthBridgeForTest } from '../AuthValueProvider'
export type { AuthValueProviderProps as BridgeProps } from '../AuthValueProvider'
