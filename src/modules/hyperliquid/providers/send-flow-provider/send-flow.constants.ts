import type { SendError, SendPercent } from './send-flow-provider.types'

/** The stable picker key for the USDC (perp) sendable token. */
export const USD_TOKEN_KEY = 'usd'

/** The stable picker-key prefix for a spot sendable token (`spot:<symbol>`). */
export const SPOT_TOKEN_KEY_PREFIX = 'spot:'

/** USDC carries 6 decimals on Hyperliquid (the usdSend precision cap). */
export const USDC_SEND_DECIMALS = 6

/**
 * Fallback max fractional precision for a spot token when its weiDecimals is
 * unknown. Hyperliquid spot `spotSend` amounts are token-denominated; 8 is the
 * common HL spot szDecimals ceiling and a safe pre-wire client guard.
 */
export const DEFAULT_SPOT_SEND_DECIMALS = 8

/** The quick-fill percentage chips of the selected token's available balance. */
export const SEND_PERCENTS: ReadonlyArray<SendPercent> = [25, 50, 75, 100]

/** Plain, non-technical cause strings per error reason (never a dead-end). */
export const SEND_ERROR_PROSE: Record<SendError, string> = {
  'amount-invalid': "That amount isn't valid. Check it and try again.",
  'insufficient-balance': "That amount isn't available to send.",
  'destination-invalid': "That recipient address isn't valid. Check it and try again.",
  'self-send': "That's your own address. Enter a different recipient.",
  'wallet-rejected': 'You declined the request in your wallet.',
  'deposit-required': 'Your account needs funds before you can send.',
  'rate-limited': 'Too many requests — wait a moment and try again.',
  network: "Couldn't reach Hyperliquid. Check your connection and try again.",
  unknown: 'Something went wrong. Please try again.',
}
