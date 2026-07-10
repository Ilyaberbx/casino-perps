import { describe, it, expect } from 'vitest'
import { symbolGradient } from '../symbol-gradient'

const NEON_ANCHOR_HUES = [265, 230, 210, 190, 305, 325]

/** Pulls the two stop hues out of the `linear-gradient(160deg, hsl(A ...), hsl(B ...))` layer. */
function stopHues(gradient: string): { base: number; second: number } {
  const match = gradient.match(
    /linear-gradient\(160deg, hsl\((\d+) \d+% \d+%\) 0%, hsl\((\d+) \d+% \d+%\) 100%\)/,
  )
  if (!match) throw new Error(`no linear layer in: ${gradient}`)
  return { base: Number(match[1]), second: Number(match[2]) }
}

describe('symbolGradient — determinism', () => {
  it('returns the identical string for repeated calls with the same symbol', () => {
    expect(symbolGradient('BTC')).toBe(symbolGradient('BTC'))
    expect(symbolGradient('ETH-PERP')).toBe(symbolGradient('ETH-PERP'))
  })

  it('is stable across many calls (no randomness / state)', () => {
    const results = Array.from({ length: 20 }, () => symbolGradient('SOL'))
    const unique = new Set(results)
    expect(unique.size).toBe(1)
  })

  it('gives different symbols visibly different gradients', () => {
    expect(symbolGradient('BTC')).not.toBe(symbolGradient('ETH'))
    expect(symbolGradient('DOGE')).not.toBe(symbolGradient('PEPE'))
  })
})

describe('symbolGradient — valid CSS shape', () => {
  it('layers a radial highlight over a 160deg two-stop linear gradient', () => {
    const gradient = symbolGradient('BTC')
    expect(gradient).toContain('radial-gradient(')
    expect(gradient).toContain('linear-gradient(160deg')
    expect(gradient.indexOf('radial-gradient')).toBeLessThan(gradient.indexOf('linear-gradient'))
  })

  it('is a comma-joined two-layer background value', () => {
    const gradient = symbolGradient('BTC')
    expect(gradient).toMatch(
      /^radial-gradient\([^)]*hsl\([^)]*\)[^)]*hsl\([^)]*\)[^)]*\), linear-gradient\(160deg, hsl\(\d+ \d+% \d+%\) 0%, hsl\(\d+ \d+% \d+%\) 100%\)$/,
    )
  })
})

describe('symbolGradient — stays in the neon register', () => {
  const symbols = ['BTC', 'ETH', 'SOL', 'DOGE', 'PEPE', 'HYPE', 'XRP', 'AVAX', 'LINK', 'ARB']

  it('always starts from a curated neon anchor hue', () => {
    for (const symbol of symbols) {
      const { base } = stopHues(symbolGradient(symbol))
      expect(NEON_ANCHOR_HUES).toContain(base)
    }
  })

  it('keeps both hues within a valid [0, 360) range', () => {
    for (const symbol of symbols) {
      const { base, second } = stopHues(symbolGradient(symbol))
      expect(base).toBeGreaterThanOrEqual(0)
      expect(base).toBeLessThan(360)
      expect(second).toBeGreaterThanOrEqual(0)
      expect(second).toBeLessThan(360)
    }
  })
})
