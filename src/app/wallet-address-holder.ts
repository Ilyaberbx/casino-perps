import type { WalletAddress } from '@/modules/shared/domain'

/**
 * Module-scope mutable holder for the address the app is keyed to. The address
 * lives outside React render so a venue factory can be passed a stable
 * `getAddress: () => WalletAddress | null` callback whose closure does not
 * capture per-render state — wallet rotation must NOT rebuild the venue;
 * the venue's connection controller absorbs the change via this callback.
 *
 * Two inputs feed the getters:
 * - the connected Primary Wallet address (set from the AppShell effect),
 * - a Spectated Address override (set from the spectate bridge).
 *
 * Two named getters read those inputs (ADR-0038, amending ADR-0021):
 * - `getCurrentWalletAddress` — the **Viewing Address** (`spectate ?? connected`):
 *   when a Spectated Address is set the venue reads it instead of the connected
 *   wallet, which re-keys the app's observation surfaces (Portfolio, account
 *   dock) to the spectated account. Keeps its name so the venue's controller
 *   reads it unchanged on each (re)connect and WS message.
 * - `getActingWalletAddress` — the **Acting Address** (connected-only, ignores
 *   spectate): keys the order flow so validation/preview/leverage/fees reflect
 *   the authenticated User's own account regardless of spectate state.
 */
let connectedAddress: WalletAddress | null = null
let spectatedAddress: WalletAddress | null = null

export function setConnectedWalletAddress(value: WalletAddress | null): void {
  connectedAddress = value
}

export function setSpectatedWalletAddress(value: WalletAddress | null): void {
  spectatedAddress = value
}

/** The Viewing Address — `spectate ?? connected` (ADR-0021 / ADR-0038). */
export function getCurrentWalletAddress(): WalletAddress | null {
  return spectatedAddress ?? connectedAddress
}

/** The Acting Address — always the connected Primary Wallet, never the
 *  Spectated Address (ADR-0038). Keys the entire order flow. */
export function getActingWalletAddress(): WalletAddress | null {
  return connectedAddress
}
