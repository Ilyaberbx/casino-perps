/**
 * Semantic transfer zones shown in the Account Activity tab's From / To columns.
 * These name the *where* of a ledger movement (a chain, an account class, a
 * vault) rather than a raw address — mirroring app.hyperliquid.xyz's wording.
 */
export const ACTIVITY_ZONE = {
  /** USDC bridges in/out via Arbitrum One. */
  arbitrum: 'Arbitrum',
  /** The Hyperliquid L1 as a whole (deposit destination). */
  hyperliquid: 'Hyperliquid',
  /** The perps (clearinghouse) account class. */
  perps: 'Perps',
  /** The spot account class. */
  spot: 'Spot',
  /** Generic (unrecognised) vault. */
  vault: 'Vault',
  /** Native staking. */
  staking: 'Staking',
} as const

/** USDC is the settlement asset for every usdc-denominated ledger delta. */
export const USDC_ASSET = 'USDC'

/**
 * Hyperliquid's HLP (Hyperliquidity Provider) vault address (mainnet),
 * lower-cased for comparison. Recognised so a deposit into / distribution from
 * it reads "HLP" in the To/From column instead of a raw 0x address — matching
 * the official UI. Any other vault address falls back to "Vault".
 */
export const HLP_VAULT_ADDRESS = '0xdfc24b077bc1425ad1dea75bcb6f8158e10df303'
