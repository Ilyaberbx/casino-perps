import { AuthValueProvider } from './AuthValueProvider'
import type { MockAuthBridgeProps } from './auth-provider.types'
import {
  MOCK_PRIVY_ID,
  mockAttachAgentSigner,
  mockCreateAgentWallet,
  mockGetAccessToken,
  mockGetWalletClient,
  mockImportPrivateKey,
  mockLinkWallet,
  mockRemoveAgentSigner,
  mockSwitchMasterWalletChain,
  noopAsync,
} from './mock-auth.utils'

// DEV-ONLY mock-auth bridge (ADR-0055). Renders the Privy-free
// `AuthValueProvider` with a synthetic connected wallet so the
// wallet-connected gate (`useIsWalletConnected()` = ready && authenticated &&
// walletReady) flips true without Privy's interactive login — unblocking
// headless Playwright verification of the Account Dock and Spectate Mode.
//
// This component is only mounted by `AuthProvider` when
// `resolveMockAuthConfig(import.meta.env)` returns non-null, which requires
// `import.meta.env.DEV === true`. In any production build the branch is dead
// code (Vite eliminates it), so this file never ships to users. It is NOT a new
// AccountAdapter port — see ADR-0004 and ADR-0055.

export function MockAuthBridge({ apiBaseUrl, config, children }: MockAuthBridgeProps) {
  return (
    <AuthValueProvider
      apiBaseUrl={apiBaseUrl}
      ready
      authenticated
      privyId={MOCK_PRIVY_ID}
      walletAddress={config.walletAddress}
      walletClientType="privy"
      walletsReady
      isBroadcastWalletReady={false}
      connectableMasterAddresses={[]}
      externalWallets={[]}
      exportableAddresses={[]}
      hasMfa={false}
      getAccessToken={mockGetAccessToken}
      logout={noopAsync}
      enrollMfa={noopAsync}
      exportWallet={noopAsync}
      importPrivateKey={mockImportPrivateKey}
      createAgentWallet={mockCreateAgentWallet}
      attachAgentSigner={mockAttachAgentSigner}
      removeAgentSigner={mockRemoveAgentSigner}
      loginWithWallet={noopAsync}
      linkWallet={mockLinkWallet}
      getMasterViemAccount={mockGetWalletClient}
      getBroadcastWalletClient={mockGetWalletClient}
      getAgentWalletBroadcastClient={mockGetWalletClient}
      switchMasterWalletChain={mockSwitchMasterWalletChain}
    >
      {children}
    </AuthValueProvider>
  )
}
