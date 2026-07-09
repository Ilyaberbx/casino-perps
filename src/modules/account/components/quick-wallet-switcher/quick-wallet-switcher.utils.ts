import { formatWalletAddress } from '@/modules/shared/utils/format-wallet-address'
import type { Wallet } from '../../domain/types'
import type { QuickWalletItem } from './quick-wallet-switcher.types'

/**
 * Maps a user wallet to a switcher item. The Native (embedded) wallet shows the
 * `Native` label; imported wallets show the truncated checksummed address —
 * identical to the Account Modal's wallet-row title (`toRow`), so the two
 * surfaces read the same.
 */
export function toItem(wallet: Wallet): QuickWalletItem {
  const isNative = wallet.source === 'embedded'
  const label = isNative ? 'Native' : formatWalletAddress(wallet.address)
  return { value: wallet.address, label, address: wallet.address, source: wallet.source }
}
