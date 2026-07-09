import { useIdleScrambleText } from './use-idle-scramble-text'
import styles from './scramble-text.module.css'
import type { IdleScrambleTextProps } from './scramble-text.types'

/**
 * Self-driving "terminal decode" label for ambient hero text (NOT interactive
 * controls). It re-scrambles on an idle interval (default 15s) without any hover,
 * resolving the glyphs left→right. The resolved label renders visually-hidden so
 * the accessible name stays stable while the visible glyphs animate; reduced
 * motion resolves instantly.
 */
export function IdleScrambleText({
  children,
  className,
  intervalMs,
  durationMs,
  runOnMount,
}: IdleScrambleTextProps) {
  const { display, label } = useIdleScrambleText(children, { intervalMs, durationMs, runOnMount })
  return (
    <span className={className} data-scramble="idle">
      <span className={styles.srOnly}>{label}</span>
      <span aria-hidden="true">{display}</span>
    </span>
  )
}
