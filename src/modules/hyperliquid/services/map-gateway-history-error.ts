import type { PortfolioHistoryFetchError } from '@/modules/shared/domain'
import type { HyperliquidGatewayError } from '../gateway/hyperliquid-gateway.types'

/**
 * Canonical reader-side mapping `HyperliquidGatewayError` →
 * `PortfolioHistoryFetchError` (PRD D8). Shared by every Portfolio history
 * reader (`tradeHistory`, `fundingHistory`, `interestHistory`,
 * `accountActivity`, …) so the gateway boundary stays SDK-shaped while
 * each reader exposes the same UI-facing error union.
 */
export function mapGatewayHistoryError(
  error: HyperliquidGatewayError,
): PortfolioHistoryFetchError {
  switch (error.kind) {
    case 'network':
      return { kind: 'network' }
    case 'rate-limited':
      return { kind: 'rate-limited' }
    case 'invalid-response':
    case 'unknown-address':
    case 'wallet-rejected':
    case 'chain-mismatch':
    case 'builder-not-funded':
    case 'deposit-required':
    case 'approval-cap-reached':
    case 'agent-cap-reached':
    case 'name-collision':
    case 'agent-address-reused':
      // History endpoints are read-only fetches — the exchange-side kinds (the
      // onboarding flow #166, deposit-required #07-01, agent-address-reused ADR-0077)
      // cannot semantically occur here. Collapse to `unknown` so the type stays exhaustive.
      return { kind: 'unknown', message: error.message }
  }
}
