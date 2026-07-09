import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Motion contract for the perp-suggestion sheet (referenced by trading/MODULE.md).
 * The sheet's identity motion is calm ease-out, never the stepped `steps()` wink
 * (which survives only on the pixel-accent CTAs), and every loop collapses under
 * prefers-reduced-motion. CSS modules are not computed in jsdom, so we assert on
 * the stylesheet source.
 */
const css = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/trading/components/perp-suggestion-sheet/perp-suggestion-sheet.module.css',
  ),
  'utf8',
)

describe('perp-suggestion-sheet motion', () => {
  it('never uses the stepped wink', () => {
    expect(css).not.toMatch(/steps\(/)
  })

  it('drives the toggle idle on a smooth ease-out curve', () => {
    expect(css).toMatch(/\.toggleIcon\b[\s\S]*var\(--ease-out/)
  })

  it('collapses every loop under prefers-reduced-motion', () => {
    const reducedBlock = css.match(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\}\s*\}/)
    expect(reducedBlock).not.toBeNull()
    expect(reducedBlock?.[0]).toMatch(/animation:\s*none/)
  })
})
