import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Reduced-motion contract for the withdraw flow (#214 modernize-ui polish).
 * The polished input focus motion must collapse to an instant state when the
 * user prefers reduced motion. CSS modules are not computed in jsdom, so we
 * assert on the stylesheet source — the stable, non-flaky contract.
 */
const css = readFileSync(
  resolve(process.cwd(), 'src/modules/agent-balance/components/withdraw-flow/withdraw-flow.module.css'),
  'utf8',
)

describe('withdraw-flow motion', () => {
  it('declares state-driven motion on the destination input', () => {
    expect(css).toMatch(/\.input\b[\s\S]*transition:/)
  })

  it('collapses motion under prefers-reduced-motion', () => {
    const reducedBlock = css.match(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\}\s*\}/)
    expect(reducedBlock).not.toBeNull()
    expect(reducedBlock?.[0]).toMatch(/transition:\s*none/)
  })
})
