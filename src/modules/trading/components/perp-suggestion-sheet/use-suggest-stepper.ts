import { useCallback, useRef, useState } from 'react'
import type { UseSuggestStepperReturn } from './perp-suggestion-sheet.types'

/**
 * Hover/focus state for the Suggest stepper's breakdown hint (Item 1). Owns the
 * open flag and the anchor/panel refs the shared `Popover` positions. Opens on
 * pointer hover and on keyboard focus (so the breakdown is reachable without a
 * mouse); closes on leave/blur. Smart hook — no JSX, unit-testable in isolation.
 */
export function useSuggestStepper(): UseSuggestStepperReturn {
  const [isHintOpen, setHintOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)

  const open = useCallback(() => setHintOpen(true), [])
  const close = useCallback(() => setHintOpen(false), [])

  return { isHintOpen, triggerRef, hintRef, open, close }
}
