import type { ReactNode } from 'react'
import type { WalletClient } from 'viem'
import type { WalletAddress } from '@/modules/shared/domain'
import type { ChainSwitchOutcome } from '../../domain/types'
import type { MockAuthConfig } from '../../account.types'

export type AuthProviderProps = {
  appId: string
  apiBaseUrl: string
  children: ReactNode
}

/**
 * Inputs to the Selected-Wallet → master-address reconciliation (Slice E).
 * `connectableAddresses` is the set of currently-connectable external master
 * addresses (lower-cased) derived from the live Privy session.
 */
export type ResolveSelectedMasterInput = {
  selectedAddress: string | null
  fallbackAddress: string | null
  connectableAddresses: ReadonlyArray<string>
}

/**
 * Result of reconciling the server-stored Selected Wallet against the live
 * Privy session. `masterAddress` is the address master-signing resolves to;
 * when the stored selection is not currently connectable it is **not** used
 * silently and does **not** fall back to Native — `masterAddress` is `null` and
 * `isSelectionConnectable: false` so the UI surfaces the connect-to-grant
 * prompt (ADR-0061 / Fix 3). `masterAddress` falls back to the canonical wallet
 * only when there is **no** stored selection at all.
 */
export type SelectedMasterResolution = {
  masterAddress: string | null
  isSelectionConnectable: boolean
}

/** Props for the DEV-only `MockAuthBridge` (ADR-0055). */
export type MockAuthBridgeProps = {
  apiBaseUrl: string
  config: MockAuthConfig
  children: ReactNode
}

export type AuthValueProviderProps = {
  apiBaseUrl: string
  ready: boolean
  authenticated: boolean
  privyId: string | null
  walletAddress: string | null
  walletClientType: string | null
  walletsReady: boolean
  /** Resolved master wallet resolvable from `useWallets()` now (see `AuthState`). */
  isBroadcastWalletReady: boolean
  /** Lower-cased addresses of every live wallet, embedded included (see `AuthState`). */
  connectableMasterAddresses: ReadonlyArray<string>
  /** Live external wallets with `walletClientType` for brand icons (see `AuthState`). */
  externalWallets: ReadonlyArray<{ address: string; walletClientType: string }>
  /** Lower-cased addresses of every Privy-managed (owner-exportable) wallet (see `AuthState`). */
  exportableAddresses: ReadonlyArray<string>
  /** Privy user has a `'totp'` factor in `user.mfaMethods` (see `AuthState`). */
  hasMfa: boolean
  getAccessToken: () => Promise<string | null>
  logout: () => Promise<void>
  /** Opens Privy's MFA enrollment modal (TOTP). Resolves when it settles. */
  enrollMfa: () => Promise<void>
  /**
   * Owner-only, MFA-gated private-key export (ADR-0076 D-5). Wraps Privy's
   * `useExportWallet().exportWallet({ address })`; resolves when the user exits
   * the export modal. Injected from AuthBridge. Tests stub with `async () => {}`.
   */
  exportWallet: (address: string) => Promise<void>
  /**
   * Raw private-key import (ADR-0076 D-6). Wraps Privy's
   * `useImportWallet().importWallet({ privateKey })`; resolves with the new
   * wallet address lower-cased. Injected from AuthBridge. Tests stub with
   * `async () => ({ address })`.
   */
  importPrivateKey: (hex: string) => Promise<{ address: string }>
  /**
   * Creates the user-owned Agent Wallet (ADR-0078): a SECOND embedded wallet via
   * Privy `createWallet({ createAdditional: true })`. Resolves the lower-cased
   * address + Privy server wallet id. Injected from AuthBridge. Tests stub with
   * `async () => ({ address: '0x…40hex', walletId: 'w' })`.
   */
  createAgentWallet: () => Promise<{ address: string; walletId: string }>
  /**
   * Attaches the app as a scoped additional signer on the Agent Wallet (ADR-0078).
   * Wraps Privy `addSigners`; resolves `true` on success, `false` on owner decline.
   * Injected from AuthBridge. Tests stub with `async () => true`.
   */
  attachAgentSigner: (input: {
    address: string
    appSignerId: string
    policyId: string
  }) => Promise<boolean>
  /**
   * Removes the app signer from the Agent Wallet on revoke (ADR-0078). Wraps Privy
   * `removeSigners`. Injected from AuthBridge. Resolves `true` on success or a
   * best-effort no-op (a benign throw is swallowed so the server row-revoke still
   * runs); `false` only when the owner declines. Tests stub with `async () => true`.
   */
  removeAgentSigner: (input: {
    address: string
    appSignerId: string
  }) => Promise<boolean>
  loginWithWallet: () => Promise<void>
  /**
   * Opens Privy's link-wallet modal and resolves with the linked external wallet
   * address (PRD-0006 Slice 06). Injected from AuthBridge (Privy-coupled). Tests
   * stub this with `async () => '0x…'`.
   */
  linkWallet: () => Promise<string>
  /**
   * Option A signing boundary (ADR-0012, superseded to WalletClient; ADR-0060):
   * injected from AuthBridge which has access to the Privy ConnectedWallet. TAKES
   * the resolved Selected-Wallet `master` address (embedded included). Returns a
   * viem WalletClient (JSON-RPC account) so the @nktkas SDK can call getChainId()
   * and resolve the correct signatureChainId for approveAgent (avoids the chainId
   * 1 / Base 8453 domain mismatch). Tests (AuthBridgeForTest) stub this with
   * `async () => null`.
   */
  getMasterViemAccount: (master: WalletAddress) => Promise<WalletClient | null>
  /**
   * Transaction-broadcast signing surface (ADR-0028; ADR-0060): injected from
   * AuthBridge which has access to the Privy ConnectedWallet. TAKES the resolved
   * Selected-Wallet `master` address. Returns a broadcast-capable viem
   * WalletClient (can writeContract / sendTransaction / switch chain on Arbitrum
   * One) for that wallet, or null when none resolvable. Tests (AuthBridgeForTest)
   * stub this with `async () => null`.
   */
  getBroadcastWalletClient: (master: WalletAddress) => Promise<WalletClient | null>
  /**
   * Agent Wallet-scoped broadcast signer (ADR-0082): injected from AuthBridge.
   * TAKES the Agent Wallet's OWN address (never the trading Selected Wallet).
   * Returns a broadcast-capable viem WalletClient bound to Base (chainId 8453)
   * for that wallet, or null when none resolvable. Tests (AuthBridgeForTest)
   * stub this with `async () => null`.
   */
  getAgentWalletBroadcastClient: (
    agentWalletAddress: WalletAddress,
  ) => Promise<WalletClient | null>
  /**
   * Privy-native master-wallet chain switch (ADR-0080): the switch that actually
   * takes effect for the embedded Native wallet (viem's raw-provider
   * `wallet_switchEthereumChain` resolves without switching). Built in AuthBridge
   * from the `ConnectedWallet`. Tests (AuthBridgeForTest) stub with
   * `async () => 'switched'`.
   */
  switchMasterWalletChain: (master: WalletAddress, chainId: number) => Promise<ChainSwitchOutcome>
  children: ReactNode
}

/**
 * Inputs to the `useAuthValue` smart hook — the resolved Privy primitives that
 * `AuthValueProvider` forwards. Identical to `AuthValueProviderProps` minus the
 * `children` (the hook derives the `AuthState`, the component renders).
 */
export type UseAuthValueInput = Omit<AuthValueProviderProps, 'children'>
