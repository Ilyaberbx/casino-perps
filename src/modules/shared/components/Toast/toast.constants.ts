/**
 * Keep-mounted exit window in ms. The provider hook flips a toast to its
 * `exiting` state, then unmounts it after this delay so the CSS exit animation
 * can play out. MUST stay >= the `toast-out` animation duration in
 * `toast.module.css` (currently 150ms) — the extra buffer guarantees the
 * animation finishes before the node is removed.
 */
export const TOAST_EXIT_MS = 180
