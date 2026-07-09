import type { ReactNode } from 'react'

export interface PixelCheckboxProps {
  /** Controlled checked state. */
  checked: boolean
  /** Fires with the next checked value on toggle. */
  onChange: (checked: boolean) => void
  /**
   * Visible label rendered beside the box; wrapping it in the same `<label>`
   * gives native click + screen-reader association with no `htmlFor`/`id`
   * plumbing. Omit for a bare box (e.g. a row multi-select) and pass `ariaLabel`
   * so the control still has an accessible name.
   */
  label?: ReactNode
  /** Accessible name when there is no visible `label`. */
  ariaLabel?: string
  disabled?: boolean
  className?: string
}
