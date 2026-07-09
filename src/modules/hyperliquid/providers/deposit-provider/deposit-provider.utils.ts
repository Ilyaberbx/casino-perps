import type { HyperliquidGatewayError } from '../../gateway/hyperliquid-gateway.types'
import type { DepositErrorReason } from './deposit-provider.types'

/**
 * Translate a gateway error kind into a deposit error reason. The deposit
 * query (userNonFundingLedgerUpdates) is read-only and has no signature — Pitfall 4.
 * Only 'deposit-required' and 'rate-limited' get named arms; every other
 * kind collapses to 'unknown' (LOW-1: intentional grouped-unknown arm).
 * The never-arm proves exhaustiveness against the full HyperliquidGatewayErrorKind union.
 */
export function gatewayKindToDepositReason(
  kind: HyperliquidGatewayError['kind'],
): DepositErrorReason {
  switch (kind) {
    case 'deposit-required':
      return 'deposit-required'
    case 'rate-limited':
      return 'rate-limited'
    case 'network':
    case 'invalid-response':
    case 'unknown-address':
    case 'wallet-rejected':
    case 'chain-mismatch':
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
