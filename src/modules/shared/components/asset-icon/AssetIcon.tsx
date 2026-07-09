import { useAssetIcon } from './use-asset-icon'
import { LetterPlaceholder } from './LetterPlaceholder'
import styles from './asset-icon.module.css'
import type { AssetIconProps } from './asset-icon.types'

/**
 * Dumb icon/placeholder switcher component.
 * No useState, no useEffect — all state owned by useAssetIcon hook.
 *
 * Three terminal render states:
 * 1. img: CDN icon loaded successfully (src != null, hasError = false)
 * 2. placeholder (errored): img fired onError; LetterPlaceholder renders instead
 * 3. placeholder (no URL): resolveMarketIconUrl returned 'placeholder'; LetterPlaceholder direct
 *
 * Container always has explicit width/height inline style (zero layout shift invariant).
 */
export function AssetIcon({ market, size = 20 }: AssetIconProps) {
  const { src, hasError, onError, isDarkFill } = useAssetIcon(market)

  const showPlaceholder = src === null || hasError
  const containerClass = isDarkFill
    ? `${styles.container} ${styles.darkFillContainer}`
    : styles.container

  if (showPlaceholder) {
    return (
      <div
        className={containerClass}
        style={{ width: size, height: size }}
        aria-label={market.baseAsset}
      >
        <LetterPlaceholder letter={market.baseAsset[0] ?? '?'} size={size} />
      </div>
    )
  }

  return (
    <div className={containerClass} style={{ width: size, height: size }}>
      <img
        src={src}
        alt={market.baseAsset}
        width={size}
        height={size}
        className={styles.img}
        /* Off-main-thread decode so a large composite spot SVG never janks the
         * scroll. Repaints across virtualized row remounts are kept instant by
         * the icon warm-cache (see use-asset-icon), not by `loading`/`eager` —
         * `eager` only forced a synchronized fetch burst on tab-switch. */
        decoding="async"
        onError={onError}
      />
    </div>
  )
}
