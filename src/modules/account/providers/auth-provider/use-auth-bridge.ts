import { useCallback, useMemo } from 'react'
import {
  usePrivy,
  useWallets,
  useMfaEnrollment,
  useExportWallet,
  useImportWallet,
  useCreateWallet,
  useSigners,
} from '@privy-io/react-auth'
import { ResultAsync } from 'neverthrow'
import { arbitrum, base } from 'viem/chains'
import type { WalletClient } from 'viem'
import type { WalletAddress } from '@/modules/shared/domain'
import { logger } from '@/app/logger'
import type { ChainSwitchOutcome } from '../../domain/types'
import type { UseAuthValueInput } from './auth-provider.types'
import {
  buildMasterWalletClient,
  coerceToAuthError,
  describeAuthError,
  findConnectedMasterWallet,
} from './auth-provider.utils'
import { useExternalWalletLogin } from './use-external-wallet-login'
import { useLinkExternalWallet } from './use-link-external-wallet'
import { useEnsureEmbeddedWallet } from './use-ensure-embedded-wallet'

const log = logger.child({ module: 'auth-bridge' })

// `useAuthBridge` is the Privy-coupled bridge hook: it reads the resolved Privy
// primitives via Privy's hooks, builds the wallet-client accessors (which need
// the `ConnectedWallet` list from `useWallets()`), and returns everything as a
// single object (the bridge value) that `AuthBridge` hands to the Privy-free
// `AuthValueProvider` as props so the auth surface stays testable without a live
// `<PrivyProvider>`. It imports no JSX/styles and is unit-testable in isolation.
export function useAuthBridge({ apiBaseUrl }: { apiBaseUrl: string }): UseAuthValueInput {
  const { ready, authenticated, user, getAccessToken, logout } = usePrivy()
  const { wallets, ready: walletsReady } = useWallets()
  const { showMfaEnrollmentModal } = useMfaEnrollment()
  const { exportWallet: privyExportWallet } = useExportWallet()
  const { importWallet: privyImportWallet } = useImportWallet()
  const { createWallet: privyCreateWallet } = useCreateWallet()
  const { addSigners, removeSigners } = useSigners()
  const { loginWithWallet } = useExternalWalletLogin()
  const { linkWallet } = useLinkExternalWallet()
  // Fallback provisioning: if Privy's `createOnLogin` is suppressed (e.g.
  // embedded wallets disabled for the app in the dashboard), an authenticated
  // user would otherwise be left with no Native wallet, stalling onboarding.
  useEnsureEmbeddedWallet({ ready, authenticated, walletsReady, user })
  // The Primary Wallet is Privy's canonical linked wallet (`user.wallet`), NOT
  // `useWallets()[0]`. With an external wallet (e.g. MetaMask) `useWallets()`
  // reflects the *currently-selected* injected account, which is frequently a
  // different address than the one Privy linked at sign-up. The server verifies
  // the onboard wallet against Privy's `linkedAccounts`; `user.wallet.address`
  // is always in that set, `wallets[0]` is not — sending the latter is the
  // opaque 403. Display, onboarding, and signing must all agree on this address.
  const canonicalWallet = user?.wallet ?? null
  const primaryAddress = canonicalWallet?.address ?? null
  const primaryClientType = canonicalWallet?.walletClientType ?? null

  // Option A signing boundary (ADR-0012, superseded to WalletClient; generalized
  // by ADR-0060): built here because ConnectedWallet objects are only available
  // inside AuthBridge via useWallets(). AuthValueProvider receives the callback as
  // a prop so it stays testable without PrivyProvider.
  //
  // ADR-0060: the accessor TAKES the target master address as a parameter — the
  // resolved Selected-Wallet master (`useSelectedWallet().masterAddress`), which
  // each consumer passes. Taking the address as a param (rather than reading the
  // selected master here) avoids a circular dep: `useSelectedWallet` depends on
  // `useAuth`. The selected master may be the embedded Native wallet — the shared
  // builder no longer filters on `walletClientType !== 'privy'`, so a selected
  // embedded/imported wallet signs (ADR-0060 D-1/D-2). When the selection is not
  // connectable, `useSelectedWallet` already falls back to the Privy-canonical
  // address before passing it here.
  //
  // Why WalletClient instead of LocalAccount: the @nktkas SDK calls getWalletChainId() to
  // build the EIP-712 domain's signatureChainId for approveAgent. A LocalAccount falls back
  // to the hardcoded default chainId 1; a WalletClient (JSON-RPC account) exposes getChainId()
  // so the SDK reads the real chain (e.g. Base = 8453). Viem rejects signTypedData when the
  // domain chainId mismatches the active chain — causing the "Provided chainId must match"
  // error that was the root cause of the testnet signing failure.
  // See ADR-0012 supersession and @nktkas signing/_abstractWallet.ts getWalletChainId.
  const getMasterViemAccount = useCallback(
    (master: WalletAddress): Promise<WalletClient | null> =>
      buildMasterWalletClient(wallets, master),
    [wallets],
  )

  // Transaction-broadcast signing surface (ADR-0028; generalized by ADR-0060): a
  // strictly larger capability than getMasterViemAccount's typed-data signing
  // client — this one is bound to Arbitrum One (chainId 42161) so writeContract /
  // sendTransaction produce on-chain transactions, and the underlying EIP-1193
  // provider exposes wallet_switchEthereumChain. Built here for the same reason as
  // the signing accessor (ConnectedWallet objects are only reachable inside
  // AuthBridge) and injected into AuthValueProvider as a prop so the auth surface
  // stays testable without PrivyProvider.
  //
  // Selection rule reused verbatim from getMasterViemAccount via the shared
  // builder: the connected wallet whose address matches the master address the
  // consumer passes (the resolved Selected-Wallet master, embedded included per
  // ADR-0060). Returns null when no matching wallet is resolvable.
  //
  // account/ exposes the capability only. The chain-switch POLICY (when to
  // switch, what to do on rejection) and all deposit logic live in the consuming
  // venue's deposit service / state machine (ADR-0028 D-3) — not here.
  const getBroadcastWalletClient = useCallback(
    (master: WalletAddress): Promise<WalletClient | null> =>
      buildMasterWalletClient(wallets, master, arbitrum),
    [wallets],
  )

  // Agent Wallet-scoped broadcast signer (ADR-0082): a sibling of
  // `getBroadcastWalletClient`, NOT a repurposing of it. Takes the AGENT
  // WALLET'S OWN address — never the trading Selected Wallet `masterAddress` —
  // and is bound to Base (chainId 8453), where the Agent Wallet's USDC lives,
  // instead of Arbitrum. The Agent Wallet is deliberately excluded from ever
  // being a selectable trading master (see `exportableAddresses` above), so
  // reusing `getBroadcastWalletClient` here would sign withdrawals with the
  // wrong wallet entirely. Same builder, same selection rule
  // (`findConnectedMasterWallet` resolves the Agent Wallet's own
  // `ConnectedWallet` from `useWallets()`, where it is already reachable) — only
  // the address and the bound chain differ.
  const getAgentWalletBroadcastClient = useCallback(
    (agentWalletAddress: WalletAddress): Promise<WalletClient | null> =>
      buildMasterWalletClient(wallets, agentWalletAddress, base),
    [wallets],
  )

  // Privy-native chain switch (ADR-0080). The embedded Native wallet does NOT
  // switch via the raw EIP-1193 provider's `wallet_switchEthereumChain` (viem's
  // `walletClient.switchChain` resolves without switching — the dead-button bug);
  // `ConnectedWallet.switchChain` is the switch that actually takes effect. Owns
  // the capability only — the venue owns when-to-switch / verify policy (ADR-0028
  // D-3). A user decline classifies to `'cancelled'` via the shared coercion →
  // `'rejected'` (non-destructive); anything else → `'failed'`.
  const switchMasterWalletChain = useCallback(
    async (master: WalletAddress, chainId: number): Promise<ChainSwitchOutcome> => {
      const wallet = findConnectedMasterWallet(wallets, master)
      if (wallet === null) return 'failed'
      const result = await ResultAsync.fromPromise(wallet.switchChain(chainId), coerceToAuthError)
      if (result.isOk()) return 'switched'
      const isUserRejection = result.error.kind === 'cancelled'
      return isUserRejection ? 'rejected' : 'failed'
    },
    [wallets],
  )

  // Whether the master wallet is actually resolvable from `wallets` right now —
  // a strictly stronger signal than `walletReady` (which only needs the canonical
  // address + walletsReady). After a page load `walletReady` can be true while an
  // injected wallet is still re-hydrating into `wallets`; consumers that must
  // broadcast (deposit preflight) gate on THIS, not `walletReady`.
  //
  // ADR-0060: keyed on the Privy-canonical `primaryAddress` — which is the
  // RESOLVED selected master's fallback (`resolveSelectedMaster` returns the
  // canonical address when no live selection or selection not connectable, and
  // the live selection is itself always present in `connectableMasterAddresses`,
  // i.e. in `wallets`, so it resolves here too). The `walletClientType !== 'privy'`
  // filter is gone, so for an embedded-only user `primaryAddress` is the embedded
  // wallet's address and it now resolves immediately — embedded users are no
  // longer permanently gated at the deposit preflight.
  const isBroadcastWalletReady =
    findConnectedMasterWallet(wallets, primaryAddress) !== null

  // The live-session signal for the Selected-Wallet → master reconciliation
  // (Slice E / ADR-0060): the lower-cased addresses of every wallet currently in
  // `useWallets()`, INCLUDING the embedded one (the `walletClientType !== 'privy'`
  // filter is removed per ADR-0060 D-2). A server-stored Selected Wallet whose
  // address is in this set — embedded or imported — is connectable now and may
  // drive signing; one that is absent must be surfaced, not silently used.
  //
  // Memoized on `[wallets]` (stable between unrelated re-renders) so the derived
  // array keeps a stable identity across Privy ticks that don't change the wallet
  // set — without it, this fresh `.map()` array feeds AuthValueProvider's value
  // `useMemo` deps and re-published the context (app-wide consumer churn) on every
  // poll/token refresh. The React Compiler can't fix it: the array is genuinely
  // new each render. See slice 05 (Opt-C1).
  const connectableMasterAddresses = useMemo(
    () => wallets.map((w) => w.address.toLowerCase()),
    [wallets],
  )

  // Live external wallets with their Privy `walletClientType`, used for
  // best-effort connector-brand icons on imported Wallet rows (PRD-0006 UI-5).
  // Lower-cased so the Wallets section can match against `me.wallets` addresses.
  // Memoized on `[wallets]` for the same reason as `connectableMasterAddresses`.
  //
  // Agent-wallet leak guard (ADR-0076): once the Agent Wallet is user-owned it
  // appears in `useWallets()` as a `walletClientType === 'privy'` wallet. This
  // filter (`!== 'privy'`) therefore already excludes it from the imported/
  // connector-brand list — a user-owned agent never renders as a link-only row.
  const externalWallets = useMemo(
    () =>
      wallets
        .filter((w) => w.walletClientType !== 'privy')
        .map((w) => ({ address: w.address.toLowerCase(), walletClientType: w.walletClientType })),
    [wallets],
  )

  // The durable runtime signal for which wallets are owner-exportable (ADR-0076
  // D-5/D-6): every Privy-managed wallet (`walletClientType === 'privy'`) — the
  // embedded Native wallet, raw-key imports (D-6), and a now-user-owned Agent
  // Wallet. Privy holds the key material for exactly these, so export is allowed
  // only here. Link-only external wallets (MetaMask-by-address) are absent — the
  // Wallets section shows them a non-export note. Lower-cased so consumers match
  // against `me.wallets` / the agent address. Memoized on `[wallets]` for the
  // same stable-identity reason as the two arrays above (Opt-C1).
  //
  // Agent-wallet leak guard, part two: this list INTENTIONALLY includes the
  // user-owned Agent Wallet (so its Export affordance lights up automatically),
  // but it is NOT a trading-selection source. The selectable trading masters are
  // derived solely from `me.wallets` (server, G-6 — the Agent Wallet is never in
  // it), and `connectableMasterAddresses` is only a connectability *check*
  // against an existing server selection, never a *source* of selectable
  // wallets — so the agent can never become a selectable trading master.
  const exportableAddresses = useMemo(
    () => wallets.filter((w) => w.walletClientType === 'privy').map((w) => w.address.toLowerCase()),
    [wallets],
  )

  // The only client-visible 2FA signal: Privy surfaces an enrolled
  // authenticator-app factor as the string `'totp'` in `user.mfaMethods`. There
  // is no server MFA flag, so the Account Modal's binary state derives from this.
  // After `enrollMfa` enrolls a TOTP factor, the Privy user re-resolves and this
  // flips true.
  const hasMfa = user?.mfaMethods?.includes('totp') ?? false

  // Normalize Privy's `showMfaEnrollmentModal` (which returns `void`) to the
  // prop's `() => Promise<void>` shape — memoized so it keeps a stable identity
  // across renders instead of feeding AuthValueProvider a new closure each tick
  // (Opt-C1).
  const enrollMfa = useCallback(
    (): Promise<void> => Promise.resolve(showMfaEnrollmentModal()),
    [showMfaEnrollmentModal],
  )

  // Owner-only, MFA-gated private-key export (ADR-0076 D-5). Privy loads the key
  // on an isolated iframe and forces MFA verification before revealing it; this
  // app never sees the key. The MFA gate itself is enforced by the consuming
  // `useWalletExport` hook (enrol-if-absent, then export). Normalized to the
  // prop's `(address) => Promise<void>` shape and memoized for a stable identity.
  const exportWallet = useCallback(
    (address: string): Promise<void> => privyExportWallet({ address }),
    [privyExportWallet],
  )

  // Raw private-key import (ADR-0076 D-6): Privy stores the key in the same
  // TEE-sharded embedded-wallet infrastructure, producing an exportable
  // `imported`-provenance wallet. Returns the new wallet address lower-cased (the
  // server stores addresses lower-cased; the Wallets section then POSTs it to
  // `/api/account/wallets/import` with `source: 'imported'`). The raw key never
  // leaves this call — it is handed straight to Privy and never logged.
  const importPrivateKey = useCallback(
    async (hex: string): Promise<{ address: string }> => {
      const wallet = await privyImportWallet({ privateKey: hex })
      return { address: wallet.address.toLowerCase() }
    },
    [privyImportWallet],
  )

  // Agent Wallet creation (ADR-0078): a SECOND, user-owned embedded wallet minted
  // on the client with `createAdditional: true`, deliberately distinct from the
  // Native embedded wallet (the `use-ensure-embedded-wallet` path). Privy holds
  // the key material, so the Agent Wallet is owner-exportable exactly like every
  // other embedded wallet. Returns the lower-cased address + the Privy server
  // wallet id (`Wallet.id`) the caller registers with the server (`POST
  // /api/agent-treasury/wallet`). `Wallet.id` can be null until the wallet is
  // delegated (it resolves once the app signer is attached), so a freshly created
  // wallet may need a brief server-side retry (staging item #6); coerced to '' here
  // and the server validates a non-empty walletId. The Privy SDK is reached only
  // from this Privy-coupled bridge — agent-balance never imports it.
  const createAgentWallet = useCallback(
    async (): Promise<{ address: string; walletId: string }> => {
      const wallet = await privyCreateWallet({ createAdditional: true })
      log.info({}, 'agent wallet created')
      return { address: wallet.address.toLowerCase(), walletId: wallet.id ?? '' }
    },
    [privyCreateWallet],
  )

  // Attach the app as a scoped additional signer on the Agent Wallet (ADR-0078
  // grant step 2). `addSigners` prompts the owner to authorize the app signer;
  // resolves `true` on success and `false` when the owner declines (the
  // delegation-grant service maps that to `signer-rejected`, non-destructive),
  // and rethrows a genuine failure (→ `signer-failed`). `policyId` scopes the
  // signer to the Minara x402 transfer the server prepared, so the app can pay
  // autonomously without it ever moving funds elsewhere.
  const attachAgentSigner = useCallback(
    async ({
      address,
      appSignerId,
      policyId,
    }: {
      address: string
      appSignerId: string
      policyId: string
    }): Promise<boolean> => {
      try {
        await addSigners({
          address,
          signers: [{ signerId: appSignerId, policyIds: [policyId] }],
        })
        log.info({}, 'agent signer attached')
        return true
      } catch (cause) {
        // A declined owner confirmation is a `cancelled` AuthError (reuses the
        // shared Privy classifier) → resolve `false`; any other throw is a real
        // failure and propagates to `signer-failed`.
        if (coerceToAuthError(cause).kind === 'cancelled') return false
        throw cause
      }
    },
    [addSigners],
  )

  // Remove the app signer on revoke (ADR-0078). Privy's `removeSigners` takes only
  // the wallet `address` and removes ALL signers on it; the app signer is the only
  // one we ever attach, so this is exact. `appSignerId` is accepted for symmetry
  // with the attach seam (and forward-compat) but the SDK call does not use it.
  //
  // Mirrors `attachAgentSigner`'s throw handling: a `cancelled` throw is the owner
  // declining the confirmation → resolve `false` (non-destructive `signer-rejected`,
  // the row stays active). ANY other throw is best-effort-swallowed → resolve `true`
  // so the authoritative server row-revoke still runs: the server row — not the Privy
  // signer — gates autonomous payments, and the most common non-cancel failure here
  // is the signer already being gone (which for a revoke is success). The Privy cause
  // is logged at the source so a genuine failure is still diagnosable.
  const removeAgentSigner = useCallback(
    async ({ address }: { address: string; appSignerId: string }): Promise<boolean> => {
      try {
        await removeSigners({ address })
        log.info({}, 'agent signer removed')
        return true
      } catch (cause) {
        const authError = coerceToAuthError(cause)
        if (authError.kind === 'cancelled') return false
        log.warn(
          describeAuthError(authError),
          'agent signer remove failed; proceeding to server revoke',
        )
        return true
      }
    },
    [removeSigners],
  )

  return {
    apiBaseUrl,
    ready,
    authenticated,
    privyId: user?.id ?? null,
    walletAddress: primaryAddress,
    walletClientType: primaryClientType,
    walletsReady,
    isBroadcastWalletReady,
    connectableMasterAddresses,
    externalWallets,
    exportableAddresses,
    hasMfa,
    getAccessToken,
    logout,
    enrollMfa,
    exportWallet,
    importPrivateKey,
    createAgentWallet,
    attachAgentSigner,
    removeAgentSigner,
    loginWithWallet,
    linkWallet,
    getMasterViemAccount,
    getBroadcastWalletClient,
    getAgentWalletBroadcastClient,
    switchMasterWalletChain,
  }
}
