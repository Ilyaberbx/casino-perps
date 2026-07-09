import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Reduced-motion contract for the Agent Balance tile (#214 modernize-ui
 * polish). The hover lift + glow must collapse to an instant, transform-free
 * state when the user prefers reduced motion. CSS modules are not computed in
 * jsdom, so we assert on the stylesheet source.
 */
const css = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/agent-balance/components/agent-balance-tile/agent-balance-tile.module.css',
  ),
  'utf8',
)

describe('agent-balance-tile motion', () => {
  it('uses a smooth ease-out curve on the tile transition', () => {
    expect(css).toMatch(/\.tile\b[\s\S]*transition:[\s\S]*var\(--ease-out/)
  })

  it('collapses motion + the hover lift under prefers-reduced-motion', () => {
    const reducedBlock = css.match(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\}\s*\}/)
    expect(reducedBlock).not.toBeNull()
    expect(reducedBlock?.[0]).toMatch(/transition:\s*none/)
    expect(reducedBlock?.[0]).toMatch(/transform:\s*none/)
  })
})
