import { describe, it, expect } from 'vitest'
import { HyperliquidGatewayError } from '../../gateway/hyperliquid-gateway.types'
import { mapGatewayHistoryError } from '../map-gateway-history-error'

describe('mapGatewayHistoryError (canonical reader-side mapping)', () => {
  it("maps 'network' to { kind: 'network' }", () => {
    expect(
      mapGatewayHistoryError(new HyperliquidGatewayError('network', 'down')),
    ).toEqual({ kind: 'network' })
  })

  it("maps 'rate-limited' to { kind: 'rate-limited' }", () => {
    expect(
      mapGatewayHistoryError(new HyperliquidGatewayError('rate-limited', 'slow')),
    ).toEqual({ kind: 'rate-limited' })
  })

  it("maps 'invalid-response' to { kind: 'unknown' } and preserves message", () => {
    const out = mapGatewayHistoryError(
      new HyperliquidGatewayError('invalid-response', 'malformed'),
    )
    expect(out.kind).toBe('unknown')
    if (out.kind === 'unknown') expect(out.message).toBe('malformed')
  })

  it("maps 'unknown-address' to { kind: 'unknown' } and preserves message", () => {
    const out = mapGatewayHistoryError(
      new HyperliquidGatewayError('unknown-address', 'no addr'),
    )
    expect(out.kind).toBe('unknown')
    if (out.kind === 'unknown') expect(out.message).toBe('no addr')
  })
})
