import { useCallback, useRef, useState } from 'react'
import type { UseInfoTooltipReturn } from './info-tooltip.types'

/**
 * Open/close + refs for `InfoTooltip`. Hover and focus open; blur and leave
 * close; click toggles (touch + keyboard). Mirrors the `SuggestStepper` hover
 * tooltip pattern — the consumer renders `Popover` only while open.
 */
export function useInfoTooltip(): UseInfoTooltipReturn {
  const [isOpen, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const open = useCallback(() => setOpen(true), [])
  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((prev) => !prev), [])
  return { isOpen, triggerRef, panelRef, open, close, toggle }
}
