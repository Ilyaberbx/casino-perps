import type { ReactNode } from 'react'

export interface ModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  /** Accessible label for the dialog. Required for a11y. */
  readonly ariaLabel: string
  /** Optional visible heading rendered at the top of the modal. */
  readonly title?: string
  /**
   * Dialog width preset. `sm` caps at ~440px for single-column, narrow-form
   * content (e.g. a single labeled input) that would otherwise float in a lot
   * of empty space at the default width; `md` (default) caps at ~720px; `lg`
   * caps at ~960px for content that needs more room (e.g. a two-column body).
   * Height/mobile behaviour is unchanged. Sizing stays CSS-owned — this just
   * selects a preset.
   */
  readonly size?: 'sm' | 'md' | 'lg'
  /**
   * Suppress the built-in close button when the consumer's header
   * renders its own close affordance. Default: false.
   * Escape and backdrop-click still call onClose regardless.
   */
  readonly hideClose?: boolean
  /**
   * Keep the dialog mounted in the DOM when closed (hidden + inert) instead of
   * unmounting it. Default: false (closed modals unmount, as every existing
   * caller expects). Opt in only when the dialog's subtree is expensive to
   * rebuild on every open — e.g. the market-selection list with ~200 remote
   * icons that would otherwise re-download and flicker on each open. Hidden
   * state is `display:none` + `inert`, so it is not focusable, not in the tab
   * order, and excluded from the accessibility tree.
   */
  readonly keepMounted?: boolean
  readonly children: ReactNode
}
