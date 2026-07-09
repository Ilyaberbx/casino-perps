import { describe, it, expect } from 'vitest'
import { trackFraction, trackPercent, toneColor } from '../pixel-slider.utils'

describe('trackFraction', () => {
  it('maps a value to its 0–1 position along the rail', () => {
    expect(trackFraction(5, 0, 10)).toBe(0.5)
  })

  it('clamps below the floor and above the ceiling', () => {
    expect(trackFraction(-3, 0, 10)).toBe(0)
    expect(trackFraction(99, 0, 10)).toBe(1)
  })

  it('returns 0 for a degenerate (zero-width) span', () => {
    expect(trackFraction(5, 10, 10)).toBe(0)
  })
})

describe('trackPercent', () => {
  it('renders the fraction as a % string', () => {
    expect(trackPercent(2, 0, 8)).toBe('25%')
  })
})

describe('toneColor (danger ramp)', () => {
  it('always resolves the neutral accent tone to the accent token', () => {
    expect(toneColor('accent', 0.99)).toBe('var(--accent)')
  })

  it('stays teal below the warn threshold on the danger ramp', () => {
    expect(toneColor('danger-ramp', 0.5)).toBe('var(--accent)')
  })

  it('heats to amber in the upper band', () => {
    expect(toneColor('danger-ramp', 0.75)).toBe('var(--warning)')
  })

  it('heats to red near the ceiling', () => {
    expect(toneColor('danger-ramp', 0.95)).toBe('var(--directionDown)')
  })
})
