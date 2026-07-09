import blackThreeEye from '@/assets/sprites/black3eye.gif'
import whiteThreeEye from '@/assets/sprites/white3eye.gif'
import styles from './ai-marker.module.css'
import { AI_MASCOT_DEFAULT_PX, AI_MASCOT_MATRIX, AI_MASCOT_SIZE } from './ai-marker.constants'
import { matrixToCells } from './ai-marker.utils'
import type { AiMascotProps } from './ai-marker.types'

/**
 * The dedicated AI mascot (ADR-0050): the brand three-eyed invader. The default
 * render is a crisp SVG-`<rect>` reconstruction of the 20×20 sprite, painted in
 * `currentColor` so it theme-swaps by contrast and is the reduced-motion floor.
 * `animated` layers the `white3eye`/`black3eye` GIF over that floor for hero
 * moments; under `prefers-reduced-motion` the GIF is hidden and the static SVG
 * shows instead, so a frozen GIF never ships. Dumb leaf.
 */
export function AiMascot({
  size = AI_MASCOT_DEFAULT_PX,
  animated = false,
  label,
  className,
}: AiMascotProps) {
  const pixels = matrixToCells(AI_MASCOT_MATRIX).map(({ x, y }) => (
    <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />
  ))
  const viewBox = `0 0 ${AI_MASCOT_SIZE} ${AI_MASCOT_SIZE}`

  if (!animated) {
    const cls = className ? `${styles.mascot} ${className}` : styles.mascot
    return (
      <svg
        className={cls}
        width={size}
        height={size}
        viewBox={viewBox}
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        shapeRendering="crispEdges"
      >
        {pixels}
      </svg>
    )
  }

  const wrapperCls = className ? `${styles.mascotAnimated} ${className}` : styles.mascotAnimated
  return (
    <span
      className={wrapperCls}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <img
        src={whiteThreeEye}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={`${styles.mascotGif} ${styles.mascotGifDark}`}
      />
      <img
        src={blackThreeEye}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={`${styles.mascotGif} ${styles.mascotGifLight}`}
      />
      {/* White-theme teal recolor: the black GIF can't be re-tinted, so the
          white theme hides both raster layers and shows this accent-filled
          element masked to the same animated sprite (exact --accent, animation
          preserved). */}
      <span
        className={`${styles.mascotGif} ${styles.mascotGifMaskLight}`}
        style={{
          width: size,
          height: size,
          WebkitMaskImage: `url(${blackThreeEye})`,
          maskImage: `url(${blackThreeEye})`,
        }}
        aria-hidden="true"
      />
      <svg
        className={styles.mascotFallback}
        width={size}
        height={size}
        viewBox={viewBox}
        aria-hidden="true"
        shapeRendering="crispEdges"
      >
        {pixels}
      </svg>
    </span>
  )
}
