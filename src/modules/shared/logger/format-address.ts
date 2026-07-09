import type { WalletAddress } from '@/modules/shared/domain/wallet-address'

export function formatAddress(address: WalletAddress | null): string {
  if (address === null) return 'unknown'
  const lower = address.toLowerCase()
  return `0x…${lower.slice(-4)}`
}

/**
 * Redact any raw 0x-prefixed 40-hex wallet address embedded in arbitrary text
 * (e.g. SDK error messages whose `.message` echoes the user address) to the
 * `0x…<last4>` form. Use at logging boundaries where the source string may
 * contain a wallet address — never log a raw wallet address.
 */
export function scrubAddresses(message: string): string {
  return message.replace(/0x[0-9a-fA-F]{40}/g, (match) => `0x…${match.slice(-4).toLowerCase()}`)
}
