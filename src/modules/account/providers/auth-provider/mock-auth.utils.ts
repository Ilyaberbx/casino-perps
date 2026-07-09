import type { WalletClient } from 'viem'
import type { ChainSwitchOutcome } from '../../domain/types'

// DEV-ONLY mock-auth handlers (ADR-0055), consumed by `MockAuthBridge`. Stable
// module-scope identities so the bridge never re-renders its subtree from new
// callback references. Logins/logout are no-ops; signing clients resolve null
// (mock mode reads only public venue data for the spectated address).

/** A synthetic Privy DID surfaced through `useAuth().privyId` in mock mode. */
export const MOCK_PRIVY_ID = 'did:privy:mock-dev-user'

export const noopAsync = async (): Promise<void> => {}

/** Mock link-wallet: rejects (no interactive Privy modal in mock mode). */
export const mockLinkWallet = async (): Promise<string> => {
  throw new Error('link-wallet is unavailable in mock-auth mode')
}

export const mockGetAccessToken = async (): Promise<string> => 'dev-mock-token'

export const mockGetWalletClient = async (): Promise<WalletClient | null> => null

/** Mock raw-key import: returns a fixed synthetic address (no Privy in mock mode). */
export const mockImportPrivateKey = async (): Promise<{ address: string }> => ({
  address: '0x0000000000000000000000000000000000000000',
})

/** Mock Agent Wallet create: returns a fixed synthetic address + walletId (no Privy in mock mode). */
export const mockCreateAgentWallet = async (): Promise<{
  address: string
  walletId: string
}> => ({ address: '0x0000000000000000000000000000000000000000', walletId: 'mock-agent-wallet' })

/** Mock attach-signer: resolves `true` (no interactive Privy confirmation in mock mode). */
export const mockAttachAgentSigner = async (): Promise<boolean> => true

/** Mock remove-signer: resolves `true` (removal succeeds; no owner decline in mock mode). */
export const mockRemoveAgentSigner = async (): Promise<boolean> => true

/** Mock chain switch: resolves `'switched'` (no interactive Privy switch in mock mode). */
export const mockSwitchMasterWalletChain = async (): Promise<ChainSwitchOutcome> => 'switched'
