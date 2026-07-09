import { useCallback, useState } from 'react'
import { clampLeverage } from './leverage-margin.utils'
import { MIN_LEVERAGE } from './leverage-margin.constants'
import type { UseLeverageSliderArgs, UseLeverageSliderReturn } from './leverage-margin.types'

/**
 * Owns the inline leverage section's draft (slider/numeric position) before it
 * is committed via the signed apply-on-release callback. Leverage commits on
 * slider release / numeric blur / Enter so the on-chain action does not fire on
 * every intermediate slider step (commit-on-release is the leverage submit
 * timing — LOCKED DECISION d). The section is always mounted inline, so the
 * draft seeds from `leverage` on mount and re-seeds (render-time tracker) when
 * the committed value changes underneath it (stream reconcile after a
 * successful set, or a market switch with a lower ceiling — the render-time
 * clamp keeps the visible value valid).
 *
 * Single-consumer hook → colocated with the section (not in module `hooks/`).
 */
export function useLeverageSlider({
  leverage,
  maxLeverage,
  onApplyLeverage,
}: UseLeverageSliderArgs): UseLeverageSliderReturn {
  const [draftInput, setDraftInput] = useState(() => String(leverage))

  const [previousLeverage, setPreviousLeverage] = useState(leverage)
  const hasLeverageChanged = previousLeverage !== leverage
  if (hasLeverageChanged) {
    setPreviousLeverage(leverage)
    setDraftInput(String(leverage))
  }

  const draftLeverage = clampLeverage(Number(draftInput), maxLeverage)

  const setSliderLeverage = useCallback((value: number) => {
    setDraftInput(String(value))
  }, [])

  const commitLeverage = useCallback(() => {
    const committed = clampLeverage(Number(draftInput), maxLeverage)
    setDraftInput(String(committed))
    const isUnchanged = committed === leverage
    if (isUnchanged) return
    onApplyLeverage(committed)
  }, [draftInput, maxLeverage, leverage, onApplyLeverage])

  return {
    draftInput,
    draftLeverage,
    minLeverage: MIN_LEVERAGE,
    setDraftInput,
    setSliderLeverage,
    commitLeverage,
  }
}
