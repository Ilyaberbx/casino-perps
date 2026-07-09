import { formatWalletAddress } from '@/modules/shared/utils/format-wallet-address'

/** The truncated recipient shown in the summary row, or an em dash when invalid. */
export function sendRecipientTail(destination: string, isDestinationValid: boolean): string {
  if (!isDestinationValid) return '—'
  return formatWalletAddress(destination)
}
