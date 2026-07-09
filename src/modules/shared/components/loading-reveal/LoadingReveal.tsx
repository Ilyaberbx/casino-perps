import styles from './loading-reveal.module.css'
import { useLoadingReveal } from './use-loading-reveal'
import type { LoadingRevealProps } from './loading-reveal.types'

/**
 * Crossfades a loading skeleton into its loaded content. While `isLoading`, the
 * skeleton shows; once loaded, the content fades in and the skeleton stays
 * mounted briefly as an overlay that fades out over it — a smooth skeleton→data
 * transition rather than a hard cut. Collapses to an instant swap under
 * `prefers-reduced-motion`. See DESIGN.md "Loading & empty states".
 */
export function LoadingReveal({ isLoading, skeleton, children }: LoadingRevealProps) {
  const { showExitSkeleton } = useLoadingReveal(isLoading)

  return (
    <div className={styles.container}>
      {isLoading ? skeleton : <div className={styles.content}>{children}</div>}
      {!isLoading && showExitSkeleton ? (
        <div className={styles.exit} aria-hidden="true">
          {skeleton}
        </div>
      ) : null}
    </div>
  )
}
