/**
 * USDC carries 6 decimals on Hyperliquid. An amount with more fractional digits
 * than this is rejected as invalid precision before signing (the wire schema
 * would reject it anyway — we fail it client-side with a plain message).
 */
export const USDC_TRANSFER_DECIMALS = 6
