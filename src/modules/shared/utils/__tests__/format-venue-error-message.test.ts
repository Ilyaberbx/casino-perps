import { describe, expect, it } from 'vitest'
import { formatVenueErrorMessage } from '../format-venue-error-message'

describe('formatVenueErrorMessage', () => {
  it('strips the "Hyperliquid API error:" prefix', () => {
    expect(formatVenueErrorMessage('Hyperliquid API error: Insufficient margin')).toBe(
      'Insufficient margin',
    )
  })

  it('strips the SDK / HTTP / WebSocket prefix variants', () => {
    expect(formatVenueErrorMessage('Hyperliquid SDK error: bad nonce')).toBe('bad nonce')
    expect(formatVenueErrorMessage('Hyperliquid HTTP error: 503 unavailable')).toBe(
      '503 unavailable',
    )
    expect(formatVenueErrorMessage('Hyperliquid WebSocket error: socket closed')).toBe(
      'socket closed',
    )
  })

  it('retains a trailing cause-chain suffix', () => {
    expect(
      formatVenueErrorMessage('Hyperliquid API error: order rejected (caused by: timeout)'),
    ).toBe('order rejected (caused by: timeout)')
  })

  it('passes through a message with no technical prefix unchanged', () => {
    expect(formatVenueErrorMessage('Insufficient margin')).toBe('Insufficient margin')
    expect(formatVenueErrorMessage('size must be > 0')).toBe('size must be > 0')
  })

  it('falls back to the trimmed original when stripping leaves nothing', () => {
    expect(formatVenueErrorMessage('Hyperliquid API error:')).toBe('Hyperliquid API error:')
  })
})
