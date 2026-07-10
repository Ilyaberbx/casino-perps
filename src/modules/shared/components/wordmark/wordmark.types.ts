/** Size variant of the {@link Wordmark}. Controls font-size only; the display
 * face, weight, skew, and tracking are fixed brand geometry (PRD 0008 §5.2). */
export type WordmarkSize = 'sm' | 'md' | 'lg'

export interface WordmarkProps {
  /** Font scale. Defaults to `md`. `sm` = mobile top bar, `lg` = rail header. */
  size?: WordmarkSize
  className?: string
}
