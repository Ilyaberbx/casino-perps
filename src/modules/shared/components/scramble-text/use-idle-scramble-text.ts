import { useEffect } from 'react'
import { DEFAULT_DURATION_MS, useDecodeReveal } from './use-decode-reveal'
import type {
  UseIdleScrambleTextOptions,
  UseIdleScrambleTextReturn,
} from './scramble-text.types'

// Default gap between idle decode ticks. Ambient, not attention-grabbing.
export const DEFAULT_IDLE_INTERVAL_MS = 15_000

/**
 * Self-driving variant of the terminal decode: re-scrambles the label on an idle
 * interval (default 15s) with no hover needed. Optionally plays one decode on
 * mount as an arrival effect. Reduced motion resolves instantly, so each tick is
 * a no-op under that preference. Off the streaming paint paths (rAF + one timer).
 */
export function useIdleScrambleText(
  text: string,
  options: UseIdleScrambleTextOptions = {},
): UseIdleScrambleTextReturn {
  const {
    intervalMs = DEFAULT_IDLE_INTERVAL_MS,
    durationMs = DEFAULT_DURATION_MS,
    runOnMount = true,
  } = options
  const { display, run, stop } = useDecodeReveal(text, durationMs)

  useEffect(() => {
    if (runOnMount) run()
    const timer = window.setInterval(() => run(), intervalMs)
    return () => {
      window.clearInterval(timer)
      stop()
    }
  }, [run, stop, intervalMs, runOnMount])

  return { display, label: text }
}
