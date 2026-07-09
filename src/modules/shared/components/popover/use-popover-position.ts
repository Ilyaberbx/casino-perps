import { useLayoutEffect } from 'react'
import type { UsePopoverPositionParams } from './popover.types'

const VIEWPORT_MARGIN_PX = 8
const ANCHOR_GAP_PX = 4

/**
 * Positions a portaled popover panel against its anchor. Runs in a layout effect
 * (before paint, no flicker) and re-measures on scroll (capture, so ancestor
 * scrolls count) and resize while mounted. Writes `position: fixed` + top/left +
 * a min-width floor directly to the panel node — no React state, so it composes
 * with the consumer's own listbox state machine and stays clear of the React
 * Compiler's setState-in-effect rule. Panel is mounted only while open (the
 * consumer gates), so this effect's lifetime is the open window.
 */
export function usePopoverPosition<A extends HTMLElement, P extends HTMLElement>({
  anchorRef,
  panelRef,
  placement,
}: UsePopoverPositionParams<A, P>): void {
  useLayoutEffect(() => {
    // `place` re-reads + self-guards so the narrowing holds inside the closure
    // (and the listeners reuse one stable reference for clean removal).
    function place(): void {
      const anchor = anchorRef.current
      const panel = panelRef.current
      if (!anchor || !panel) return

      const anchorRect = anchor.getBoundingClientRect()

      // Give the panel its real (shrink-wrapped) layout BEFORE measuring it.
      // Freshly portaled into document.body it is otherwise a block-level node in
      // normal flow, so its measured width ≈ the full body/viewport width. With
      // `placement: 'bottom-end'` that makes `anchorRect.right - panelRect.width`
      // underflow and the left clamp snaps the panel to the top-left corner. A
      // fixed (no top/left) node shrink-wraps to its content, so measuring after
      // this gives the true panel width.
      panel.style.position = 'fixed'
      panel.style.minWidth = `${anchorRect.width}px`

      const panelRect = panel.getBoundingClientRect()

      const spaceBelow = window.innerHeight - anchorRect.bottom
      const spaceAbove = anchorRect.top
      const fitsBelow = spaceBelow >= panelRect.height + ANCHOR_GAP_PX
      const shouldFlipUp = !fitsBelow && spaceAbove > spaceBelow
      const rawTop = shouldFlipUp
        ? anchorRect.top - panelRect.height - ANCHOR_GAP_PX
        : anchorRect.bottom + ANCHOR_GAP_PX
      const top = Math.max(VIEWPORT_MARGIN_PX, rawTop)

      const isEndAligned = placement === 'bottom-end'
      const rawLeft = isEndAligned ? anchorRect.right - panelRect.width : anchorRect.left
      const maxLeft = window.innerWidth - panelRect.width - VIEWPORT_MARGIN_PX
      const left = Math.max(VIEWPORT_MARGIN_PX, Math.min(rawLeft, maxLeft))

      panel.style.top = `${top}px`
      panel.style.left = `${left}px`
    }

    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [anchorRef, panelRef, placement])
}
