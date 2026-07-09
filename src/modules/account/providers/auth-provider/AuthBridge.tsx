import type { ReactNode } from 'react'
import { useAuthBridge } from './use-auth-bridge'
import { AuthValueProvider } from './AuthValueProvider'

// `AuthBridge` is the Privy-coupled bridge: it reads the resolved Privy
// primitives via Privy's hooks, builds the wallet-client accessors (which need
// the `ConnectedWallet` list from `useWallets()`), and hands everything to the
// Privy-free `AuthValueProvider` as props so the auth surface stays testable
// without a live `<PrivyProvider>`. All that Privy-coupled derivation lives in
// the `useAuthBridge` smart hook (smart-hook + dumb-component pattern); this
// component is a thin shell that forwards the bridge value as props.
export function AuthBridge({ apiBaseUrl, children }: { apiBaseUrl: string; children: ReactNode }) {
  const bridge = useAuthBridge({ apiBaseUrl })
  return <AuthValueProvider {...bridge}>{children}</AuthValueProvider>
}
