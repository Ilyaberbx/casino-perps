import { AssetIcon } from '@/modules/shared/components/asset-icon'
import styles from './pnl-card.module.css'
import { PnlSideArrow } from './PnlSideArrow'
import { CARD_ART, SIDE_LABELS } from './pnl-card.constants'
import { collectibleKeyOf } from './pnl-card.utils'
import type { PnlCardProps } from './pnl-card.types'

// Source-agnostic, venue-agnostic PnL card (v2). Renders a normalized
// `PnlCardView` over one of the 48 collectible composite backgrounds (planet ×
// mascot × theme) at a fixed 1080×680 so `modern-screenshot` captures it
// crisply. The capture `ref` is forwarded to the root. The artwork already
// carries the backdrop, planet + mascot, the baked `@invaderstrade` handle
// (top-left) and the `MASCOT × PLANET` tag (top-right) — so the card overlays
// live data ONLY in the left-centre block and the bottom-left stat row, never in
// the top corners. `data-theme` drives the ink palette (independent of the app
// theme); `data-hero-sign` tints the hero figure teal (profit/neutral) or red.
export function PnlCard({
  view,
  displayMode,
  selection,
  iconDataUrl,
  isIconResolving,
  ref,
}: PnlCardProps) {
  const backgroundUrl = CARD_ART[collectibleKeyOf(selection)]

  const showPct = displayMode === 'pct' && view.heroPctLabel !== null
  const heroMain = showPct ? view.heroPctLabel : view.heroUsdLabel
  const heroSub = showPct ? view.heroUsdLabel : view.heroPctLabel
  const heroLabel = view.heroSign === 'negative' ? 'LOSS' : 'PROFIT'

  const sidePillText =
    view.leverageLabel !== null
      ? `${SIDE_LABELS[view.side]} · ${view.leverageLabel}`
      : SIDE_LABELS[view.side]

  const letterFallback = view.displaySymbol.charAt(0).toUpperCase()
  const isSubDistinct = heroSub !== null && heroSub !== heroMain
  const hasHandle = view.handle !== null && view.handle.length > 0

  // Icon render ladder. Prefer the inlined data URL — it's the only form that
  // survives into the exported PNG (a cross-origin CDN `<img>` renders on screen
  // but rasterizes blank; see `usePnlCardCaptureIcon`). While it's still
  // resolving, show the live `AssetIcon` as a graceful placeholder; once
  // resolution settles with nothing inlinable, fall to the letter (captures
  // cleanly, unlike a blank remote icon).
  const showLiveIcon = iconDataUrl === null && isIconResolving && view.market !== null

  return (
    <div
      ref={ref}
      className={styles.card}
      data-side={view.side}
      data-hero-sign={view.heroSign}
      data-mode={view.mode}
      data-theme={selection.theme}
      style={{ backgroundImage: `url(${backgroundUrl})` }}
    >
      <div className={styles.leftBlock}>
        <div className={styles.marketRow}>
          {iconDataUrl !== null ? (
            <img className={styles.marketIcon} src={iconDataUrl} alt="" width={44} height={44} />
          ) : showLiveIcon && view.market !== null ? (
            <AssetIcon market={view.market} size={44} />
          ) : (
            <span className={styles.assetLetter}>{letterFallback}</span>
          )}
          <span className={styles.marketTitle}>{view.displaySymbol}</span>
          <span className={styles.sidePill}>
            <PnlSideArrow side={view.side} />
            {sidePillText}
          </span>
          {view.venueIconSrc !== null ? (
            <img
              className={styles.venueIcon}
              src={view.venueIconSrc}
              alt=""
              width={28}
              height={28}
            />
          ) : null}
        </div>

        <span className={styles.heroLabel}>{heroLabel}</span>
        <span className={styles.heroMain}>{heroMain}</span>
        {isSubDistinct ? <span className={styles.heroSub}>{heroSub}</span> : null}
      </div>

      <div className={styles.statRow}>
        {view.entryPriceLabel !== null ? (
          <div className={styles.stat}>
            <span className={styles.statLabel}>ENTRY</span>
            <span className={styles.statValue}>{view.entryPriceLabel}</span>
          </div>
        ) : null}
        {view.markPriceLabel !== null ? (
          <div className={styles.stat}>
            <span className={styles.statLabel}>{view.markRowLabel.toUpperCase()}</span>
            <span className={styles.statValue}>{view.markPriceLabel}</span>
          </div>
        ) : null}
        {hasHandle ? (
          <div className={styles.stat}>
            <span className={styles.statLabel}>TRADER</span>
            <span className={styles.statValue} data-accent="true">
              @{view.handle}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
