/** One filled sprite cell in the mascot matrix, in cell (not px) units. */
export interface MascotCell {
  readonly x: number
  readonly y: number
}

export interface AiMascotProps {
  /** Square px size. */
  readonly size?: number
  /**
   * Layer the animated GIF over the static SVG floor (hero "alive" moments).
   * Dropped to the static frame under `prefers-reduced-motion`. Default `false`.
   */
  readonly animated?: boolean
  /**
   * Accessible label. When provided the mascot is `role="img"`; when omitted it
   * is decorative (`aria-hidden`) and the surrounding control carries the label.
   */
  readonly label?: string
  readonly className?: string
}
