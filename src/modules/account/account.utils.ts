import type { Me, Wallet } from './domain/types'

/**
 * The Native Wallet is the Privy embedded wallet (`source: 'embedded'`) — the
 * deterministic seed for the default avatar (PRD-0006 UI-2/UI-3). Falls back to
 * the selected wallet, then the first wallet, so a malformed `Me` never crashes
 * the header/modal render.
 */
export function selectNativeWallet(me: Me): Wallet | null {
  const embedded = me.wallets.find((w) => w.source === 'embedded')
  const selected = me.wallets.find((w) => w.isSelected)
  return embedded ?? selected ?? me.wallets[0] ?? null
}
