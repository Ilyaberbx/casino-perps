import { parseWalletAddress, type WalletAddress } from '@/modules/shared/domain'
import { useAuth } from '../providers/auth-provider'
import { useOnboardingFlow } from './use-onboarding-flow'
import { resolveSelectedMaster } from '../providers/auth-provider/auth-provider.utils'
import { selectNativeWallet } from '../account.utils'
import type { SelectedWalletView } from './use-selected-wallet.types'

export type { SelectedWalletView } from './use-selected-wallet.types'

/**
 * The Selected-Wallet → master-address resolution + live-session reconciliation
 * seam (PRD-0006 Slice E). Composes the server-stored Selected Wallet (the
 * `Me` wallet with `isSelected: true`, persisted across devices) with the live
 * Privy session (`connectableMasterAddresses` from `useAuth()`) via the pure
 * `resolveSelectedMaster`.
 *
 * - When the Selected Wallet is currently connectable it becomes the master the
 *   existing external-master signing path resolves to.
 * - When a stored selection is **not** currently connectable, `masterAddress`
 *   falls back to the Privy-canonical wallet and `isSelectionConnectable` is
 *   `false` — the UI surfaces the mismatch, the selection is never silently used.
 *
 * This is the seam slice 07 builds on to re-key the venue-readiness predicates +
 * agent-key lookup from the Primary Wallet to the Selected Wallet. This slice
 * establishes the resolution + reconciliation; it does not yet re-key those
 * consumers (kept minimal — that is slice 07's job).
 */
export function useSelectedWallet(): SelectedWalletView {
  const { primaryWalletAddress, connectableMasterAddresses } = useAuth()
  const flow = useOnboardingFlow()

  const selectedAddress = flow.kind === 'ready' ? selectedAddressOf(flow.me.wallets) : null
  const fallbackAddress = primaryWalletAddress
  // The Native (embedded) wallet — the account-stable identity the Hyperliquid
  // agent key + name are keyed on (ADR-0061). `selectNativeWallet` prefers the
  // `source: 'embedded'` wallet, falling back so a malformed `Me` never crashes.
  const nativeAddress = flow.kind === 'ready' ? selectNativeWallet(flow.me)?.address ?? null : null

  const resolution = resolveSelectedMaster({
    selectedAddress,
    fallbackAddress,
    connectableAddresses: connectableMasterAddresses,
  })

  // Brand the reconciled addresses (Slice 07): the consumers that re-key on the
  // Selected Wallet (agent key / builder fee / deposit milestone) need the
  // `WalletAddress` brand. The server stores wallet addresses lower-cased (auth
  // contract), so `parseWalletAddress` validates + brands without re-casing risk;
  // a non-parsing value (never expected) collapses to `null`, which the consumers
  // treat as "no master" (no signing).
  return {
    selectedAddress: brandAddress(selectedAddress),
    masterAddress: brandAddress(resolution.masterAddress),
    nativeAddress: brandAddress(nativeAddress),
    isSelectionConnectable: resolution.isSelectionConnectable,
  }
}

function brandAddress(address: string | null): WalletAddress | null {
  if (address === null) return null
  return parseWalletAddress(address).unwrapOr(null)
}

function selectedAddressOf(
  wallets: ReadonlyArray<{ address: string; isSelected: boolean }>,
): string | null {
  return wallets.find((w) => w.isSelected)?.address ?? null
}
