import minaraMark from '@/assets/brand/minara-logo-white.png'
import threeEyeGif from '@/assets/sprites/white3eye.gif'
import { AiMascot } from '@/modules/shared/components/ai-marker'
import styles from './perp-suggestion-sheet.module.css'
import type { AgentIconProps } from './perp-suggestion-sheet.types'

const DEFAULT_SIZE = 28

/**
 * Renders an agent's icon (ADR-0048, slice 07). Minara shows its official mark;
 * the Native/AI motif is the three-eye, delegated to the shared `AiMascot` (the
 * single sprite reconstruction, ADR-0050). **Optimization:** persistent
 * placements pass `animated={false}` and get the static decoded frame (the crisp
 * pixel mascot, the static PNG for Minara); only the transient loading beat
 * passes `animated` and runs the GIF. Dumb leaf — the parent decides `animated`
 * (and drops it under reduced-motion).
 */
export function AgentIcon({
  kind,
  animated = false,
  size = DEFAULT_SIZE,
  className,
}: AgentIconProps) {
  const cls = className ? `${styles.agentIcon} ${className}` : styles.agentIcon

  if (kind === 'minara') {
    return (
      <img
        src={minaraMark}
        alt="Minara"
        width={size}
        height={size}
        className={cls}
        data-animated={animated}
      />
    )
  }

  if (animated) {
    return (
      <img
        src={threeEyeGif}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={cls}
      />
    )
  }

  return <AiMascot size={size} label="AI agent" className={cls} />
}
