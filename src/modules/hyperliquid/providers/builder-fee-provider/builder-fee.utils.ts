import { HyperliquidGatewayError } from '../../gateway/hyperliquid-gateway.types'
import type { BuilderFeeApprovalErrorReason } from './builder-fee-provider.types'

/**
 * Translate a gateway error kind into a builder-fee approval reason. Mirrors
 * `gatewayKindToAgentReason` in the agent provider; the kinds unique to the
 * builder-fee path are `builder-not-funded` and `approval-cap-reached`. Agent-
 * specific kinds (`agent-cap-reached`, `name-collision`) collapse into
 * `unknown` because they cannot semantically surface from this call site.
 */
export function gatewayKindToBuilderReason(
  kind: HyperliquidGatewayError['kind'],
): BuilderFeeApprovalErrorReason {
  switch (kind) {
    case 'wallet-rejected':
      return 'wallet-rejected'
    case 'chain-mismatch':
      return 'chain-mismatch'
    case 'builder-not-funded':
      return 'builder-not-funded'
    case 'approval-cap-reached':
      return 'approval-cap-reached'
    case 'rate-limited':
      return 'rate-limited'
    case 'deposit-required':
      return 'deposit-required'
    case 'network':
    case 'invalid-response':
    case 'unknown-address':
    case 'agent-cap-reached':
    case 'name-collision':
    case 'agent-address-reused':
      // ADR-0077 `agent-address-reused` is agent-only and cannot surface from a
      // builder approval; collapse to `unknown` to keep the switch exhaustive.
      return 'unknown'
    default: {
      const exhaustive: never = kind
      return exhaustive
    }
  }
}
