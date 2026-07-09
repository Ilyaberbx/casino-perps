/** Return of the trigger-agnostic decode engine shared by the idle scramble hook. */
export interface UseDecodeRevealReturn {
  /** The string to render right now (scrambled mid-decode, the label at rest). */
  display: string
  /** Start one decode cycle. */
  run: () => void
  /** Cancel any in-flight decode frame. */
  stop: () => void
}

export interface UseIdleScrambleTextOptions {
  /** Ms between idle decode ticks. Default 15000. */
  intervalMs?: number
  /** Total decode duration in ms. Default 600. */
  durationMs?: number
  /** Play one decode immediately on mount before the first interval. Default true. */
  runOnMount?: boolean
}

export interface UseIdleScrambleTextReturn {
  /** The string to render right now (scrambled mid-decode, the label at rest). */
  display: string
  /** The stable, resolved label — rendered visually-hidden for the accessible name. */
  label: string
}

export interface IdleScrambleTextProps {
  /**
   * The resolved label. It idly decodes on an interval (no hover needed) and rests
   * as this text verbatim.
   */
  children: string
  /** Optional class on the wrapper span. */
  className?: string
  /** Ms between idle decode ticks. Default 15000. */
  intervalMs?: number
  /** Total decode duration in ms. Default 600. */
  durationMs?: number
  /** Play one decode on mount as an arrival effect. Default true. */
  runOnMount?: boolean
}
