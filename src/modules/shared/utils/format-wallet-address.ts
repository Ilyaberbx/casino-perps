import { getAddress } from 'viem'

const HEAD_HEX_CHARS = 4
const TAIL_HEX_CHARS = 4

/**
 * Collapse a wallet address to a checksummed `0x<head>…<tail>` shorthand for
 * display. Uses the U+2026 ellipsis (single char) per DESIGN.md typography.
 * Throws on invalid input (mirrors `viem.getAddress`).
 *
 * This is the single display-truncation helper for wallet addresses across the
 * client. For *logging* redaction use `shared/logger`'s `formatAddress` instead
 * — that one deliberately hides the head (`0x…<last4>`); this one keeps the
 * head so a human can recognise their own address.
 */
export function formatWalletAddress(address: string): string {
  const checksum = getAddress(address)
  const head = checksum.slice(2, 2 + HEAD_HEX_CHARS)
  const tail = checksum.slice(-TAIL_HEX_CHARS)
  return `0x${head}…${tail}`
}
