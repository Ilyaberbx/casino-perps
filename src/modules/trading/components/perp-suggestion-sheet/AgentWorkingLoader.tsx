import { AgentIcon } from './AgentIcon'
import { AGENT_WORKING_COPY } from './perp-suggestion-sheet.constants'
import styles from './perp-suggestion-sheet.module.css'
import type { AgentWorkingLoaderProps } from './perp-suggestion-sheet.types'

/**
 * The agent-working loading beat (slice 09/12). The **selected agent's** icon
 * animates while the paid call runs — Minara's mark for Minara, the three-eye for
 * Native — so the screen honestly reflects who is computing. The animated GIF
 * runs only here; `animated` is dropped to the static frame under reduced-motion.
 * Dumb.
 */
export function AgentWorkingLoader({
  iconKind,
  agentLabel,
  animated,
}: AgentWorkingLoaderProps) {
  return (
    <div
      className={styles.loader}
      role="status"
      aria-live="polite"
      data-testid="agent-working"
    >
      <AgentIcon
        kind={iconKind}
        animated={animated}
        size={48}
        className={styles.loaderIcon}
      />
      <p className={styles.loaderText}>
        <strong>{agentLabel}</strong> {AGENT_WORKING_COPY}
      </p>
    </div>
  )
}
