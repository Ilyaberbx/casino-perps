import { useState } from 'react'

interface AttemptState {
  identity: string
  failedCount: number
}

const INITIAL_ATTEMPT: AttemptState = { identity: '', failedCount: 0 }

export interface UseIconLadderResult {
  /** The current candidate URL, or null when every rung has errored. */
  src: string | null
  /** Wire to the `<img>` `onError`; advances one rung down the ladder. */
  onError: () => void
}

/**
 * Walks an ordered icon-URL candidate list: each `onError` advances one rung;
 * running off the end yields `src: null` (render the caller's placeholder).
 * `identity` is what the failure count tracks against, so a caller switching
 * subjects (a different symbol) resets the ladder without a setState-in-effect.
 * The state pattern mirrors `useAssetIcon`; this is the symbol-only reusable
 * core for surfaces that don't need AssetIcon's extra styling concerns.
 */
export function useIconLadder(identity: string, candidates: readonly string[]): UseIconLadderResult {
  const [attempt, setAttempt] = useState<AttemptState>(INITIAL_ATTEMPT)
  const isAttemptForCurrentIdentity = attempt.identity === identity
  const failedCount = isAttemptForCurrentIdentity ? attempt.failedCount : 0

  const src = candidates[failedCount] ?? null

  const onError = () => {
    setAttempt({ identity, failedCount: failedCount + 1 })
  }

  return { src, onError }
}
