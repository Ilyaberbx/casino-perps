import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '@/modules/shared/hooks/use-prefers-reduced-motion'
import { LIVE_WINS_ROTATE_INTERVAL_MS } from '../../social.constants'
import { LIVE_WINS_SEED } from '../../social.fixtures'
import type { LiveWin } from '../../social.types'
import { createLiveWinId, rotateLeft, withLiveWinId } from '../../social.utils'
import type { LiveWinsViewModel } from './live-wins-ticker.types'

function seedWins(): LiveWin[] {
  return LIVE_WINS_SEED.map((seed, index) => withLiveWinId(seed, createLiveWinId(index)))
}

/**
 * Smart hook for the LIVE WINS strip. Holds a fixed-length window of fabricated
 * wins and rotates it on a timer so a fresh card scrolls in without the list (or
 * memory) growing. Under prefers-reduced-motion the strip is held completely
 * still: rotation stops and the CSS marquee is disabled (`isAnimated: false`).
 */
export function useLiveWins(): LiveWinsViewModel {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [wins, setWins] = useState<LiveWin[]>(seedWins)

  useEffect(() => {
    if (prefersReducedMotion) return
    const intervalId = window.setInterval(() => {
      setWins((current) => rotateLeft(current))
    }, LIVE_WINS_ROTATE_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [prefersReducedMotion])

  return { wins, isAnimated: !prefersReducedMotion }
}
