import { describe, it, expect } from 'vitest'
import { PlaceOrderError } from '@/modules/shared/domain'
import type { PlaceOrderOutcome } from '@/modules/shared/domain'
import {
  buildPendingOrderToast,
  buildOutcomeToast,
  buildOrderErrorToast,
  placeOrderErrorMessage,
  PLACE_ORDER_ERROR_COPY,
} from '../order-entry.utils'

const CLOID = '0xa99a0000000000000000000000000000'

describe('order-entry toast payloads', () => {
  it('pending toast is info, keyed by cloid, and names the side as Long/Short', () => {
    const payload = buildPendingOrderToast(CLOID, 'buy', 'BTC-PERP')
    expect(payload.id).toBe(CLOID)
    expect(payload.variant).toBe('info')
    expect(payload.title).toContain('Long')
    // Display symbol is stripped of the -PERP identity suffix.
    expect(payload.title).toContain('BTC')
    expect(payload.title).not.toContain('BTC-PERP')
  })

  it('uses Short for a sell-side pending toast', () => {
    const payload = buildPendingOrderToast(CLOID, 'sell', 'ETH-PERP')
    expect(payload.title).toContain('Short')
  })

  it('filled outcome → success toast with size and price', () => {
    const outcome: PlaceOrderOutcome = {
      kind: 'filled',
      orderIdentifier: 'o1',
      symbol: 'BTC-PERP',
      averagePrice: 60_000,
      filledSize: 0.5,
      timestamp: 1,
    }
    const payload = buildOutcomeToast(CLOID, 'BTC-PERP', outcome)
    expect(payload.id).toBe(CLOID)
    expect(payload.variant).toBe('success')
    expect(payload.title).toBe('Filled')
    expect(payload.description).toContain('0.5')
    expect(payload.description).toContain('60000')
  })

  it('partially-filled outcome → success toast titled Partially filled', () => {
    const outcome: PlaceOrderOutcome = {
      kind: 'partially-filled',
      orderIdentifier: 'o1',
      symbol: 'BTC-PERP',
      averagePrice: 60_000,
      filledSize: 0.3,
      remainingSize: 0.2,
      timestamp: 1,
    }
    const payload = buildOutcomeToast(CLOID, 'BTC-PERP', outcome)
    expect(payload.title).toBe('Partially filled')
  })

  it('resting outcome → success toast saying it is on the book', () => {
    const outcome: PlaceOrderOutcome = {
      kind: 'resting',
      orderIdentifier: 'o1',
      symbol: 'BTC-PERP',
      timestamp: 1,
    }
    const payload = buildOutcomeToast(CLOID, 'BTC-PERP', outcome)
    expect(payload.variant).toBe('success')
    expect(payload.title).toBe('Order resting')
  })

  it('error → error toast passing the venue reason through', () => {
    const payload = buildOrderErrorToast(CLOID, new PlaceOrderError('rejected', 'insufficient margin'))
    expect(payload.id).toBe(CLOID)
    expect(payload.variant).toBe('error')
    expect(payload.description).toBe('insufficient margin')
  })

  it('error → error toast strips the venue technical prefix', () => {
    const payload = buildOrderErrorToast(
      CLOID,
      new PlaceOrderError('rejected', 'Hyperliquid API error: insufficient margin'),
    )
    expect(payload.description).toBe('insufficient margin')
  })
})

describe('placeOrderErrorMessage (inline copy)', () => {
  it('passes the venue reason through for a rejected error (label stripped)', () => {
    expect(
      placeOrderErrorMessage(new PlaceOrderError('rejected', 'insufficient margin')),
    ).toBe('insufficient margin')
    expect(
      placeOrderErrorMessage(
        new PlaceOrderError('rejected', 'Hyperliquid API error: insufficient margin'),
      ),
    ).toBe('insufficient margin')
  })

  it('maps every non-rejected kind to friendly copy, never the raw venue string', () => {
    const kinds = Object.keys(PLACE_ORDER_ERROR_COPY) as Array<
      keyof typeof PLACE_ORDER_ERROR_COPY
    >
    for (const kind of kinds) {
      const message = placeOrderErrorMessage(new PlaceOrderError(kind, 'raw venue text'))
      expect(message).toBe(PLACE_ORDER_ERROR_COPY[kind])
      expect(message).not.toBe('raw venue text')
    }
  })
})
