const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Returns the tabbable elements inside a container, in DOM order. Used by the
 * Modal focus trap to wrap Tab / Shift+Tab at the dialog boundary so keyboard
 * focus never escapes an open modal.
 */
export function getFocusableElements(container: HTMLElement): ReadonlyArray<HTMLElement> {
  const nodes = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  return Array.from(nodes).filter((node) => {
    const isHidden = node.hasAttribute('hidden')
    const isExplicitlyUntabbable = node.getAttribute('tabindex') === '-1'
    return !isHidden && !isExplicitlyUntabbable
  })
}

interface WrapTabFocusOptions {
  /**
   * When `true`, a Shift+Tab pressed while the active element is *outside* the
   * dialog also wraps to the last focusable (treats "focus has escaped" the same
   * as "focus is on the first element"). When omitted/`false`, only an active
   * element equal to the first focusable wraps backward.
   */
  includeOutsideActive?: boolean
}

/**
 * Wraps keyboard focus at a dialog's boundary for a `Tab` / `Shift+Tab` key
 * event so focus never escapes an open dialog. Pure DOM helper shared by the
 * `Modal` and `Sheet` focus traps — the caller is responsible for gating on
 * `event.key === 'Tab'` before calling.
 *
 * The `includeOutsideActive` option parameterizes the one behavioural difference
 * between the two callers (see `WrapTabFocusOptions`).
 */
export function wrapTabFocus(
  dialog: HTMLElement,
  event: KeyboardEvent,
  options?: WrapTabFocusOptions,
): void {
  const focusable = getFocusableElements(dialog)
  const first = focusable[0] ?? dialog
  const last = focusable[focusable.length - 1] ?? dialog
  const active = document.activeElement
  const isReverse = event.shiftKey

  const isActiveOutsideDialog = !dialog.contains(active)
  const treatOutsideAsAtFirst = options?.includeOutsideActive === true && isActiveOutsideDialog
  const isLeavingForward = !isReverse && active === last
  const isLeavingBackward = isReverse && (active === first || treatOutsideAsAtFirst)

  if (isLeavingForward) {
    event.preventDefault()
    first.focus()
    return
  }
  if (isLeavingBackward) {
    event.preventDefault()
    last.focus()
  }
}
