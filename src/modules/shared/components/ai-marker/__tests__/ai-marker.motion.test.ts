import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Motion contract for the AI marker system. The mascot is the surviving identity
 * mark (the loud frame + badge layer was retired), so the marker never
 * uses stepped easing, and under prefers-reduced-motion the animated GIF gives
 * way to the static mascot fallback. CSS modules are not computed in jsdom, so we
 * assert on the stylesheet source.
 */
const css = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/shared/components/ai-marker/ai-marker.module.css',
  ),
  'utf8',
)

describe('ai-marker motion', () => {
  it('never uses stepped easing', () => {
    expect(css).not.toMatch(/steps\(/)
  })

  it('reveals the static mascot under prefers-reduced-motion', () => {
    const reducedBlock = css.match(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\}\s*\}/)
    expect(reducedBlock).not.toBeNull()
    expect(reducedBlock?.[0]).toMatch(/\.mascotFallback\s*\{[\s\S]*display:\s*block/)
  })
})
