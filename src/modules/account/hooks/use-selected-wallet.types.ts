/**
 * The reconciled Selected-Wallet → master-address view (PRD-0006 Slice E).
 *
 * The **Selected Wallet** is server-stored (persists across devices) on the
 * `Me`'s wallet with `isSelected: true`. This view reconciles it against the
 * live Privy session:
 *
 * - `selectedAddress` — the server-stored Selected Wallet address (`null` before
 *   `Me` resolves).
 * - `masterAddress` — the address the **grant/deposit/builder** master-signing
 *   path resolves to: the Selected Wallet when it is currently connectable, else
 *   **`null`** (ADR-0061 / Fix 3). It is **never** silently the Privy-canonical
 *   wallet — an imported selection that is linked-but-not-connected resolves to
 *   `null`, which signing consumers treat as `signing-unavailable` (the
 *   connect-to-grant affordance), not a silent Native-wallet signature.
 * - `nativeAddress` — the **Native (embedded) wallet** address (ADR-0061), the
 *   account-stable identity the Hyperliquid agent key + name are keyed on (one
 *   agent per account). Derived via `selectNativeWallet(me)`; `null` before `Me`
 *   resolves.
 * - `isSelectionConnectable` — `false` when a server selection exists but is not
 *   currently connectable (e.g. the user is on a different device / has not yet
 *   re-connected that wallet). The UI surfaces this rather than trading as if it
 *   were live.
 */
import type { WalletAddress } from '@/modules/shared/domain'

export type SelectedWalletView = {
  readonly selectedAddress: WalletAddress | null
  readonly masterAddress: WalletAddress | null
  readonly nativeAddress: WalletAddress | null
  readonly isSelectionConnectable: boolean
}
