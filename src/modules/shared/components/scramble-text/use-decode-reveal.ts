import { useCallback, useEffect, useRef, useState } from 'react'
import type { UseDecodeRevealReturn } from './scramble-text.types'

// Uppercase glyph pool for the decode — letters + digits + a couple of terminal
// symbols. Spaces in the label are preserved (never scrambled).
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&$@*!?<>/'
export const DEFAULT_DURATION_MS = 600

function randomGlyph(): string {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * The shared "terminal decode" engine: scrambles `text` through random uppercase
 * glyphs and resolves it left→right over `durationMs` each time `run()` is called.
 * Trigger-agnostic on purpose — callers wire it to hover/focus (`useScrambleText`)
 * or to an idle interval (`useIdleScrambleText`). Reduced motion resolves instantly.
 */
export function useDecodeReveal(
  text: string,
  durationMs = DEFAULT_DURATION_MS,
): UseDecodeRevealReturn {
  const [display, setDisplay] = useState(text)
  const frameRef = useRef(0)
  // Latest label, read inside the rAF loop so a label change mid-flight resolves
  // to the new text rather than the stale one.
  const textRef = useRef(text)

  useEffect(() => {
    textRef.current = text
    // Not mid-decode → reflect the new label immediately.
    if (frameRef.current === 0) setDisplay(text)
  }, [text])

  const stop = useCallback(() => {
    if (frameRef.current === 0) return
    cancelAnimationFrame(frameRef.current)
    frameRef.current = 0
  }, [])

  const run = useCallback(() => {
    const target = textRef.current
    if (prefersReducedMotion()) {
      setDisplay(target)
      return
    }
    stop()
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      const revealed = Math.floor(progress * target.length)
      let out = ''
      for (let index = 0; index < target.length; index++) {
        const char = target[index]
        const isSpace = char === ' '
        const isResolved = index < revealed
        out += isSpace ? ' ' : isResolved ? char : randomGlyph()
      }
      setDisplay(out)
      const isComplete = progress >= 1
      if (!isComplete) {
        frameRef.current = requestAnimationFrame(tick)
        return
      }
      frameRef.current = 0
      setDisplay(target)
    }
    frameRef.current = requestAnimationFrame(tick)
  }, [durationMs, stop])

  return { display, run, stop }
}
