import type { EvmCoreError, EvmCorePercent } from './evm-core-flow-provider.types'

// The token-system-address constants are HyperEVM-domain (the EVM-side mechanism)
// and live with the chain integration in `services/hyperevm.constants.ts`
// (ADR-0069); re-exported here so the slice-1 utils keep their local import.
export {
  HYPE_TOKEN_NAME,
  HYPE_SYSTEM_ADDRESS,
  SYSTEM_ADDRESS_BASE,
} from '../../services/hyperevm.constants'

/** The stable picker-key prefix for an EVM⇄Core movable token (`evm-core:<symbol>`). */
export const EVM_CORE_TOKEN_KEY_PREFIX = 'evm-core:'

/**
 * Fallback Core-side max fractional precision for a token when its weiDecimals is
 * unknown. 8 is the common HL spot szDecimals ceiling and a safe pre-wire guard.
 */
export const DEFAULT_EVM_CORE_DECIMALS = 8

/** The quick-fill percentage chips of the selected token's available balance. */
export const EVM_CORE_PERCENTS: ReadonlyArray<EvmCorePercent> = [25, 50, 75, 100]

/** Plain, non-technical cause strings per error reason (never a dead-end). */
export const EVM_CORE_ERROR_PROSE: Record<EvmCoreError, string> = {
  'amount-invalid': "That amount isn't valid. Check it and try again.",
  'insufficient-balance': "That amount isn't available to move.",
  'wallet-rejected': 'You declined the request in your wallet.',
  'deposit-required': 'Your account needs funds before you can move tokens.',
  'rate-limited': 'Too many requests — wait a moment and try again.',
  network: "Couldn't reach Hyperliquid. Check your connection and try again.",
  'chain-switch-failed': "Couldn't switch your wallet to HyperEVM. Try again.",
  'transfer-failed': "The HyperEVM transfer didn't go through. Try again.",
  unknown: 'Something went wrong. Please try again.',
}
