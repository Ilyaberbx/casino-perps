import { useEffect, useRef, useState } from 'react'
import { LOADING_REVEAL_EXIT_MS } from './loading-reveal.constants'

/**
 * Drives the crossfade: keeps the skeleton mounted for one fade-out window after
 * `isLoading` flips false, so the content can fade in underneath it (a real
 * skeleton→data crossfade instead of a hard cut). Edge-detected via a ref so the
 * timer only arms on the true→false transition, never on every render.
 */
export function useLoadingReveal(isLoading: boolean): { showExitSkeleton: boolean } {
  const [showExitSkeleton, setShowExitSkeleton] = useState(false)
  const wasLoadingRef = useRef(isLoading)

  useEffect(() => {
    const wasLoading = wasLoadingRef.current
    wasLoadingRef.current = isLoading
    const justFinishedLoading = wasLoading && !isLoading
    if (!justFinishedLoading) return
    setShowExitSkeleton(true)
    const timer = window.setTimeout(() => setShowExitSkeleton(false), LOADING_REVEAL_EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [isLoading])

  return { showExitSkeleton }
}
