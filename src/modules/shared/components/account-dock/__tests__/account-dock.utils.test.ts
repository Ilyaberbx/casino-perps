import { describe, it, expect } from 'vitest'
import {
  formatGmtOffsetLabel,
  fillCrossingLabel,
  formatTokenWithUnit,
  formatFillSize,
  formatDockSymbol,
} from '../account-dock.utils'

describe('formatGmtOffsetLabel', () => {
  // Input mirrors Date.prototype.getTimezoneOffset(): minutes behind UTC, so a
  // zone three hours *ahead* of UTC reports -180.
  it('labels a whole-hour zone ahead of UTC', () => {
    expect(formatGmtOffsetLabel(-180)).toBe('GMT+3')
  })

  it('labels a zone behind UTC', () => {
    expect(formatGmtOffsetLabel(300)).toBe('GMT-5')
  })

  it('labels a half-hour zone with minutes', () => {
    expect(formatGmtOffsetLabel(-330)).toBe('GMT+5:30')
  })

  it('labels UTC as +0', () => {
    expect(formatGmtOffsetLabel(0)).toBe('GMT+0')
  })
})

describe('fillCrossingLabel', () => {
  it('maps crossed:true to Taker', () => {
    expect(fillCrossingLabel(true)).toBe('Taker')
  })

  it('maps crossed:false to Maker (false is NOT absent)', () => {
    expect(fillCrossingLabel(false)).toBe('Maker')
  })

  it('renders -- when the flag is absent', () => {
    expect(fillCrossingLabel(undefined)).toBe('--')
  })
})

describe('formatTokenWithUnit', () => {
  it('denominates a value in its token verbatim, never converting', () => {
    expect(formatTokenWithUnit(11.61, 'USDC')).toBe('11.61 USDC')
  })

  it('keeps small fee precision (no collapse to 0.011)', () => {
    expect(formatTokenWithUnit(0.010613, 'USDC')).toBe('0.010613 USDC')
  })

  it('forces a leading + on non-negative signed values', () => {
    expect(formatTokenWithUnit(0.00154, 'USDC', { signed: true })).toBe('+0.00154 USDC')
  })

  it('renders a negative signed value with a leading -', () => {
    expect(formatTokenWithUnit(-0.5, 'USDC', { signed: true })).toBe('-0.5 USDC')
  })

  it('renders a non-USDC fee token verbatim', () => {
    expect(formatTokenWithUnit(0.0001, 'HYPE')).toBe('0.0001 HYPE')
  })
})

describe('formatFillSize', () => {
  it('suffixes a perp coin with its base asset', () => {
    expect(formatFillSize(0.00022, 'BTC')).toBe('0.00022 BTC')
  })

  it('suffixes a HIP-3 fill with the asset, stripping the dex prefix', () => {
    expect(formatFillSize(3, 'xyz:NVDA')).toBe('3 NVDA')
  })

  it('omits the suffix for a spot pair symbol (no "0.5 PURR/USDC")', () => {
    expect(formatFillSize(0.5, 'PURR/USDC')).toBe('0.5')
  })

  it('omits the suffix for an @N spot key (no "0.5 @107")', () => {
    expect(formatFillSize(0.5, '@107')).toBe('0.5')
  })
})

describe('formatDockSymbol', () => {
  it('strips the perp identity suffix', () => {
    expect(formatDockSymbol('BTC-PERP')).toBe('BTC')
  })

  it('strips the HIP-3 dex prefix', () => {
    expect(formatDockSymbol('xyz:NVDA')).toBe('NVDA')
  })

  it('passes a bare perp coin through', () => {
    expect(formatDockSymbol('BTC')).toBe('BTC')
  })
})
