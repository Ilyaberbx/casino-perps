import { createWalletClient, custom, type Chain, type WalletClient } from 'viem'
import type { ConnectedWallet } from '@privy-io/react-auth'
import type { AuthError, WalletSource } from '../../domain/types'
import type {
  ResolveSelectedMasterInput,
  SelectedMasterResolution,
} from './auth-provider.types'

export function deriveWalletSource(walletClientType: string): WalletSource {
  if (walletClientType === 'privy') return 'embedded'
  return 'external'
}

/**
 * Resolve the **connected master wallet**: the connected wallet in
 * `useWallets()` whose address matches `masterWalletAddress` case-insensitively,
 * regardless of wallet type. The embedded Privy wallet (`walletClientType ===
 * 'privy'`) is a valid match — per ADR-0060 the signing master is the Selected
 * Wallet and may be the embedded Native wallet. Single source of the selection
 * rule shared by `getMasterViemAccount` (typed-data signing),
 * `getBroadcastWalletClient` (Arbitrum broadcast), and the
 * `isBroadcastWalletReady` gate.
 *
 * Returns `null` when no wallet matching `masterWalletAddress` is present in
 * `wallets` yet. On first load that is **transient** for an injected external
 * wallet (MetaMask, etc.) re-hydrating into `useWallets()` a tick after the
 * address is known — the window that produced the deposit flow's first-open
 * `wallet-unavailable` abort. The embedded wallet is always present in
 * `useWallets()`, so it resolves immediately.
 */
export function findConnectedMasterWallet(
  wallets: ConnectedWallet[],
  masterWalletAddress: string | null,
): ConnectedWallet | null {
  return (
    wallets.find((w) => {
      const matchesMasterAddress =
        masterWalletAddress !== null &&
        w.address.toLowerCase() === masterWalletAddress.toLowerCase()
      return matchesMasterAddress
    }) ?? null
  )
}

/**
 * Build a viem `WalletClient` from the resolved **connected master wallet**'s
 * EIP-1193 provider. Single parameterised factory behind both `AuthState`
 * accessors: `getMasterViemAccount` (typed-data signing — no `chain`, so the
 * SDK reads the live chain via `getChainId()`) and `getBroadcastWalletClient`
 * (transaction broadcast — `chain: arbitrum`, so `writeContract` /
 * `sendTransaction` / `wallet_switchEthereumChain` target Arbitrum One). The
 * only difference between the two is whether a `chain` is bound; everything
 * else (selection rule, provider fetch, client shape) is identical.
 *
 * Returns `null` when no master wallet matching `masterWalletAddress` is
 * resolvable from `wallets`. Pure factory — no React, no module state.
 *
 * Invariant: `getEthereumProvider()` is available on every `ConnectedWallet`
 * that passed `findConnectedMasterWallet` — Privy guarantees both external and
 * embedded wallets expose an EIP-1193 provider (ADR-0060 D-2).
 */
export async function buildMasterWalletClient(
  wallets: ConnectedWallet[],
  masterWalletAddress: string | null,
  chain?: Chain,
): Promise<WalletClient | null> {
  const masterWallet = findConnectedMasterWallet(wallets, masterWalletAddress)
  if (masterWallet === null) return null

  const eip1193Provider = await masterWallet.getEthereumProvider()
  return createWalletClient({
    account: masterWallet.address as `0x${string}`,
    chain,
    transport: custom(eip1193Provider),
  })
}

/**
 * Reconcile the server-stored **Selected Wallet** against the live Privy
 * session (Slice E / ADR-0060). The Selected Wallet becomes the master-wallet
 * pointer that the signing path resolves to **only when it is currently
 * connectable** (a wallet — external OR embedded — present in the live session).
 *
 * - A stored selection that IS connectable → it is the master; flag `true`.
 * - A stored selection that is NOT currently connectable → we do **not** use it
 *   silently, and we do **not** fall back to the Native/canonical wallet either
 *   (ADR-0061 / Fix 3): `masterAddress` is `null` and `isSelectionConnectable`
 *   is `false`. Signing consumers treat `null` as `signing-unavailable` → the
 *   connect-to-grant affordance, never a silent Native-wallet signature for an
 *   imported selection the user picked.
 * - No stored selection → fall back to `fallbackAddress` (the Privy canonical
 *   wallet); nothing to reconcile, flag `true`.
 *
 * Pure — the live-session signal arrives as `connectableAddresses` (lower-cased
 * connectable master addresses, including the embedded wallet per ADR-0060) so
 * this needs no `ConnectedWallet` / React.
 */
export function resolveSelectedMaster(
  input: ResolveSelectedMasterInput,
): SelectedMasterResolution {
  const { selectedAddress, fallbackAddress, connectableAddresses } = input
  const hasStoredSelection = selectedAddress !== null
  if (!hasStoredSelection) {
    return { masterAddress: fallbackAddress, isSelectionConnectable: true }
  }
  const isSelectionConnectable = connectableAddresses.includes(
    selectedAddress.toLowerCase(),
  )
  if (isSelectionConnectable) {
    return { masterAddress: selectedAddress, isSelectionConnectable: true }
  }
  // A picked-but-not-connectable selection: resolve to `null`, never the Native
  // fallback (ADR-0061 / Fix 3). The UI prompts the user to connect the selected
  // wallet to grant/sign; we never sign silently as the Native wallet.
  return { masterAddress: null, isSelectionConnectable: false }
}

const NO_CREDENTIAL_CODES = new Set(['user_does_not_exist', 'invalid_credentials'])
const CANCELLED_CODES = new Set([
  'exited_auth_flow',
  'exited_link_flow',
  'exited_update_flow',
])
const NOT_CONFIGURED_CODES = new Set(['disallowed_login_method', 'not_supported'])

function readPrivyErrorCode(cause: unknown): string | null {
  if (typeof cause !== 'object' || cause === null) return null
  const code = (cause as { privyErrorCode?: unknown }).privyErrorCode
  return typeof code === 'string' ? code : null
}

/**
 * Safe log fields for an `AuthError`. For every kind but `unknown` the kind is
 * the whole story. For `unknown` the real Privy cause is otherwise lost (the
 * warn callsite only had `kind`), so extract the diagnostic fields — `name`,
 * `message`, `privyErrorCode`. Privy connect/login error metadata carries no
 * JWT, no key, no PII, so it is safe to log (mirrors the server's
 * `describePrivyError`).
 */
export function describeAuthError(error: AuthError): Record<string, unknown> {
  if (error.kind !== 'unknown') return { kind: error.kind }
  const e = error.cause as
    | { name?: unknown; message?: unknown; privyErrorCode?: unknown }
    | null
    | undefined
  return {
    kind: error.kind,
    name: typeof e?.name === 'string' ? e.name : undefined,
    message: typeof e?.message === 'string' ? e.message : undefined,
    privyErrorCode:
      typeof e?.privyErrorCode === 'string' ? e.privyErrorCode : undefined,
  }
}

function coerceErrorFromPrivyCode(cause: unknown): AuthError | null {
  const privyCode = readPrivyErrorCode(cause)
  if (privyCode === null) return null
  if (NO_CREDENTIAL_CODES.has(privyCode)) return { kind: 'no-credential' }
  if (CANCELLED_CODES.has(privyCode)) return { kind: 'cancelled' }
  if (NOT_CONFIGURED_CODES.has(privyCode)) return { kind: 'not-configured' }
  return null
}

function coerceErrorFromMessage(cause: unknown): AuthError | null {
  if (!(cause instanceof Error)) return null
  const message = cause.message.toLowerCase()
  const isCancelled = message.includes('rejected') || message.includes('cancelled')
  if (isCancelled) return { kind: 'cancelled' }
  return null
}

export function coerceToAuthError(cause: unknown): AuthError {
  const fromCode = coerceErrorFromPrivyCode(cause)
  if (fromCode !== null) return fromCode

  const fromMessage = coerceErrorFromMessage(cause)
  if (fromMessage !== null) return fromMessage

  return { kind: 'unknown', cause }
}
