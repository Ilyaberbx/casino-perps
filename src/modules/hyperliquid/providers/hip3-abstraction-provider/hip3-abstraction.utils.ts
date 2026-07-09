import type { Hip3AbstractionErrorReason } from '@/modules/shared/domain'
import type { HyperliquidGatewayError } from '../../gateway/hyperliquid-gateway.types'
import type { UserAbstractionResponse } from '../../gateway/sdk-types'

/**
 * An account's collateral is abstracted across HIP-3 DEXs — so it can trade
 * HIP-3 markets without a per-DEX transfer — when its abstraction mode is
 * `dexAbstraction` (the default-account opt-in) OR `unifiedAccount` /
 * `portfolioMargin` (which pool all collateral by design). Only the classic
 * `default` / `disabled` modes lack it and need `enableDexAbstraction`.
 */
export function isAbstractionEnabled(mode: UserAbstractionResponse): boolean {
  return mode === 'dexAbstraction' || mode === 'unifiedAccount' || mode === 'portfolioMargin'
}

/**
 * Translate a gateway error kind into a venue-agnostic HIP-3 abstraction reason.
 * Mirrors `gatewayKindToBuilderReason`; kinds that cannot semantically surface
 * from a `userDexAbstraction` / `userAbstraction` call collapse to `unknown`.
 */
export function gatewayKindToHip3Reason(
  kind: HyperliquidGatewayError['kind'],
): Hip3AbstractionErrorReason {
  switch (kind) {
    case 'wallet-rejected':
      return 'wallet-rejected'
    case 'chain-mismatch':
      return 'chain-mismatch'
    case 'deposit-required':
      return 'deposit-required'
    case 'rate-limited':
      return 'rate-limited'
    case 'network':
    case 'invalid-response':
    case 'unknown-address':
    case 'builder-not-funded':
    case 'approval-cap-reached':
    case 'agent-cap-reached':
    case 'name-collision':
    case 'agent-address-reused':
      return 'unknown'
    default: {
      const exhaustive: never = kind
      return exhaustive
    }
  }
}
