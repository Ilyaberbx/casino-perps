import type { ButtonHTMLAttributes, Ref } from 'react'
import type { LucideIcon } from 'lucide-react'

export type IconButtonTone = 'neutral' | 'destructive' | 'accent' | 'ghost'

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  /** The lucide icon component rendered inside the button. */
  readonly icon: LucideIcon
  /** Accessible name for the icon-only control (required — there is no text). */
  readonly ariaLabel: string
  /** Visual intent. Defaults to `neutral`. */
  readonly tone?: IconButtonTone
  /** Opt-in raised glass chrome (ADR-0070), matching Badge's 3D look. Off by
   *  default — most consumers (Sheet/Modal close, toolbar icons) stay calm-at-rest
   *  per ADR-0043. */
  readonly elevated?: boolean
  /** Forwarded to the underlying `<button>` (e.g. the Sheet close for focus). */
  readonly ref?: Ref<HTMLButtonElement>
}
