import { createContext } from 'react'
import type { ResultAsync } from 'neverthrow'
import type { WalletClient } from 'viem'
import type { ApiClient } from '@/modules/shared/http'
import type { WalletAddress } from '@/modules/shared/domain'
import type { AuthError, ChainSwitchOutcome, WalletSource } from '../../domain/types'

export type AuthState = {
  ready: boolean
  authenticated: boolean
  privyId: string | null
  walletAddress: string | null
  primaryWalletAddress: WalletAddress | null
  walletSource: WalletSource | null
  walletReady: boolean
  /**
   * Whether the resolved master wallet is resolvable from `useWallets()` right
   * now — i.e. `getBroadcastWalletClient(master)` will return a client, not null.
   * A strictly stronger signal than `walletReady`: after a page load `walletReady`
   * flips true on the canonical address while an injected wallet is still
   * re-hydrating into `wallets`. Consumers that must broadcast a transaction (the
   * Hyperliquid deposit preflight) gate on THIS to avoid a first-open
   * `wallet-unavailable` abort. ADR-0060: keyed on the Privy-canonical master,
   * with the `walletClientType !== 'privy'` filter removed — so for an
   * embedded-only user the embedded wallet resolves here and the user is **no
   * longer permanently gated** at the deposit preflight.
   */
  isBroadcastWalletReady: boolean
  /**
   * Lower-cased addresses of every wallet currently live in the Privy session —
   * INCLUDING the embedded one (ADR-0060 D-2 removed the `!== 'privy'` filter) —
   * i.e. those for which `findConnectedMasterWallet` would resolve a signer right
   * now. The live-session signal the Selected-Wallet → master reconciliation
   * reads (Slice E): a server-stored Selected Wallet whose address is absent here
   * is **not** currently connectable and must be surfaced, not silently used.
   */
  connectableMasterAddresses: ReadonlyArray<string>
  /**
   * The live external (non-`privy`) wallets in the Privy session, each carrying
   * its lower-cased `address` + Privy `walletClientType` (e.g. `metamask`,
   * `coinbase_wallet`). Best-effort connector-brand resolution for imported
   * Wallet rows reads this (PRD-0006 UI-5); a wallet absent here falls back to
   * the deterministic `Web3Avatar`. Empty for embedded-only users.
   */
  externalWallets: ReadonlyArray<{ address: string; walletClientType: string }>
  /**
   * Lower-cased addresses of every **Privy-managed** wallet (`walletClientType
   * === 'privy'`) — the embedded Native wallet, raw-key imports (ADR-0076 D-6),
   * and a now-user-owned Agent Wallet (ADR-0076 D-1). These are the wallets
   * Privy holds key material for, hence the only ones the owner can export
   * (D-5). The Wallets section uses this as the runtime guard for the **Export
   * private key** affordance (with `Wallet.source` as the provenance source of
   * truth). Link-only `external` wallets are absent. Includes the Agent Wallet
   * **on purpose** — its export affordance lights up automatically once
   * user-owned — but this is NOT a trading-selection source (selectable masters
   * come only from `me.wallets`, which never contains the Agent Wallet, G-6).
   */
  exportableAddresses: ReadonlyArray<string>
  /**
   * Whether the Privy user has an authenticator-app TOTP factor enrolled
   * (`user.mfaMethods` contains `'totp'`). This is the only client-visible signal
   * for the Account Modal's binary 2FA state — there is **no** server MFA flag.
   * `false` until Privy resolves the user; flips `true` once `enrollMfa` enrolls a
   * TOTP factor and the Privy user re-resolves.
   */
  hasMfa: boolean
  getAccessToken: () => Promise<string | null>
  logout: () => Promise<void>
  /**
   * Opens Privy's MFA enrollment modal (authenticator-app TOTP). Optional /
   * skippable — surfaced in the onboarding stepper's MFA step and the Account
   * Modal's 2FA section. Resolves when the enrollment flow settles; the Privy user
   * re-resolves and `hasMfa` flips `true`.
   */
  enrollMfa: () => ResultAsync<void, AuthError>
  /**
   * Owner-only, MFA-gated private-key export (ADR-0076 D-5). Wraps Privy's
   * `useExportWallet().exportWallet({ address })` — Privy loads the key on an
   * isolated iframe and forces MFA verification before revealing it, so the app
   * never sees it. Resolves when the user exits the export modal. The MFA gate
   * (enrol-if-absent, then export) is orchestrated by the `useWalletExport` hook,
   * not here. Pass the address of a Privy-managed wallet (one in
   * `exportableAddresses`); exporting a link-only `external` wallet is not
   * possible (Privy holds no key for it).
   */
  exportWallet: (address: string) => Promise<void>
  /**
   * Raw private-key import (ADR-0076 D-6). Wraps Privy's
   * `useImportWallet().importWallet({ privateKey })`. Privy stores the key in the
   * same TEE-sharded embedded-wallet infrastructure, producing an exportable
   * `imported`-provenance wallet. Resolves with the new wallet address
   * lower-cased; the caller then persists it via `POST /api/account/wallets/import`
   * with `source: 'imported'`. The raw key is handed straight to Privy and never
   * logged or otherwise surfaced.
   */
  importPrivateKey: (hex: string) => Promise<{ address: string }>
  /**
   * Creates the user-owned Agent Wallet (ADR-0078): a SECOND embedded wallet via
   * Privy `createWallet({ createAdditional: true })`, distinct from the Native
   * embedded wallet. Resolves the lower-cased address + the Privy server wallet id
   * the caller registers with the server (`POST /api/agent-treasury/wallet`). The
   * Agent Wallet is a user-owned wallet by construction — Privy holds its key, so
   * it is owner-exportable like any other embedded wallet (no app-owned variant).
   * `agent-balance` injects this as the default behind its create-on-not-registered
   * flow; the Privy SDK stays behind this seam (agent-balance never imports it).
   */
  createAgentWallet: () => Promise<{ address: string; walletId: string }>
  /**
   * Attaches the app as a scoped additional signer on the Agent Wallet (ADR-0078
   * grant step 2). Wraps Privy `addSigners({ address, signers: [{ signerId, policyIds }] })`;
   * resolves `true` on success and `false` when the owner declines the
   * confirmation (mapped to `signer-rejected` by the delegation-grant service). The
   * `policyId` scopes the app signer to the Minara x402 transfer the server
   * prepared, so the app can pay autonomously and can never move funds elsewhere.
   */
  attachAgentSigner: (input: {
    address: string
    appSignerId: string
    policyId: string
  }) => Promise<boolean>
  /**
   * Removes the app signer from the Agent Wallet on revoke (ADR-0078). Wraps Privy
   * `removeSigners({ address })` (removes all signers — the app signer is the only
   * one attached). The delegation-grant service calls this BEFORE the server marks
   * the row revoked. Resolves `true` on success or a best-effort no-op (a benign
   * throw is swallowed so the server row-revoke still runs); `false` only when the
   * owner declines the removal confirmation.
   */
  removeAgentSigner: (input: {
    address: string
    appSignerId: string
  }) => Promise<boolean>
  loginWithWallet: () => ResultAsync<void, AuthError>
  /**
   * Opens Privy's link-wallet modal and resolves with the linked **external**
   * wallet address (PRD-0006 Slice 06). The Wallets section feeds that address
   * to `POST /api/account/wallets/import`; ownership is proven server-side. The
   * Privy integration is centralised here (only `account/` touches Privy).
   */
  linkWallet: () => ResultAsync<string, AuthError>
  openConnectModal: () => void
  closeConnectModal: () => void
  isConnectModalOpen: boolean
  apiClient: ApiClient
  /**
   * Option A signing boundary (ADR-0012, superseded to WalletClient; ADR-0060):
   * exposes the **Selected Wallet** as a viem WalletClient (JSON-RPC account) so
   * hyperliquid/ can sign without importing @privy-io/react-auth. TAKES the target
   * `master` address — the resolved Selected-Wallet master from
   * `useSelectedWallet().masterAddress` — so each consumer signs as the Selected
   * Wallet (ADR-0060 D-1), which may be the embedded Native wallet (ADR-0060 D-2).
   * The address is a parameter (not read here) to avoid a circular dep:
   * `useSelectedWallet` depends on `useAuth`. Returns null when no connected wallet
   * matches `master` (still re-hydrating / not in the live session).
   *
   * The returned WalletClient satisfies the SDK's AbstractViemJsonRpcAccount interface
   * (signTypedData + getAddresses + getChainId). getChainId() is essential: the SDK calls
   * it to set signatureChainId for approveAgent; a LocalAccount cannot convey chain and
   * falls back to chainId 1, breaking wallets on other chains (e.g. Base, chainId 8453).
   */
  getMasterViemAccount: (master: WalletAddress) => Promise<WalletClient | null>
  /**
   * Transaction-broadcast signing surface (ADR-0028; ADR-0060): exposes the
   * **Selected Wallet** as a broadcast-capable viem WalletClient — one that can
   * `writeContract` / `sendTransaction` and `wallet_switchEthereumChain` on
   * Arbitrum One (chainId 42161). This is a strictly larger surface than
   * `getMasterViemAccount`'s typed-data signing client; the two are siblings with
   * distinct contracts and must not be conflated. TAKES the target `master`
   * address (the resolved Selected-Wallet master), embedded included per ADR-0060.
   * Returns null when no connected wallet matches `master`.
   *
   * `account/` owns the wallet capability only — the chain-switch POLICY (when
   * to switch, what to do on rejection) and any deposit logic live in the
   * consuming venue's deposit service / state machine, not here (ADR-0028 D-3).
   */
  getBroadcastWalletClient: (master: WalletAddress) => Promise<WalletClient | null>
  /**
   * Agent Wallet-scoped broadcast signer (ADR-0082): a sibling of
   * `getBroadcastWalletClient`, bound to the AGENT WALLET'S OWN address (never
   * the trading Selected Wallet) and to Base (chainId 8453), where the Agent
   * Wallet's USDC lives, instead of Arbitrum. The Agent Wallet is never a
   * selectable trading master (see `getBroadcastWalletClient`'s doc), so
   * withdrawing from it must never resolve its signer via the trading-wallet
   * accessor. Returns null when the Agent Wallet is not resolvable from the
   * live Privy session.
   */
  getAgentWalletBroadcastClient: (
    agentWalletAddress: WalletAddress,
  ) => Promise<WalletClient | null>
  /**
   * Switch the master wallet to `chainId` via Privy's native
   * `ConnectedWallet.switchChain` (ADR-0080). This — NOT viem's
   * `walletClient.switchChain` on the raw EIP-1193 provider — is the switch that
   * actually takes effect for the embedded Native wallet (the raw-provider
   * `wallet_switchEthereumChain` resolves without switching, the dead-button bug).
   * TAKES the resolved Selected-Wallet `master` address; resolves the connected
   * wallet via the shared `findConnectedMasterWallet` rule. Returns a neutral
   * `ChainSwitchOutcome` — `account/` owns the capability, the venue owns the
   * policy (ADR-0028 D-3 / ADR-0080 D-2). `chainId` must be in Privy's
   * `supportedChains` allow-list or Privy rejects it. Privy does NOT update
   * already-built providers, so callers must re-request `getBroadcastWalletClient`
   * to observe the new chain and verify the switch landed (ADR-0080 D-3).
   */
  switchMasterWalletChain: (master: WalletAddress, chainId: number) => Promise<ChainSwitchOutcome>
}

export const AuthContext = createContext<AuthState | null>(null)
