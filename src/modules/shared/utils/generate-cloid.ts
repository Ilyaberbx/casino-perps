/**
 * Builds a Hyperliquid cloid (client order id): `0x` + 32 lowercase hex chars
 * (16 bytes). The leading chars come from `prefix` (so our fills are
 * recognisable as originating from this app — PRD decision 7); the remaining
 * chars are filled with randomness. The prefix is supplied by the caller (it
 * lives in `hyperliquid.constants.ts` — this util stays venue-agnostic in
 * `shared/`).
 *
 * `randomHex` is injectable for deterministic tests; it must return a lowercase
 * hex string of at least the requested length. The default draws from
 * `crypto.getRandomValues`.
 */
const CLOID_HEX_LENGTH = 32

export function generateCloid(
  prefix: string,
  randomHex: (length: number) => string = defaultRandomHex,
): `0x${string}` {
  const normalizedPrefix = prefix.toLowerCase()
  const fillLength = CLOID_HEX_LENGTH - normalizedPrefix.length
  const fill = fillLength > 0 ? randomHex(fillLength) : ''
  const body = `${normalizedPrefix}${fill}`.slice(0, CLOID_HEX_LENGTH)
  return `0x${body}`
}

function defaultRandomHex(length: number): string {
  const byteCount = Math.ceil(length / 2)
  const bytes = new Uint8Array(byteCount)
  crypto.getRandomValues(bytes)
  let hex = ''
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex.slice(0, length)
}
