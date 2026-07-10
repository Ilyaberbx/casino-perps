import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MarketCard, MarketCardSkeleton } from '../market-card'
import { tradeHref } from '../../utils/trade-href'
import { useCarousel } from './use-carousel'
import { toChangePct } from './market-carousel.utils'
import styles from './market-carousel.module.css'
import type { MarketCarouselProps } from './market-carousel.types'

// Placeholder cards shown while the venue universe loads. Enough to fill a wide
// row so the loading state reads as a populated carousel, not a stub.
const SKELETON_COUNT = 8
const SKELETON_KEYS = Array.from({ length: SKELETON_COUNT }, (_, i) => i)

// The trade screen hosts the full, searchable market list — the closest "see
// all" surface, since the lobby has no per-category route.
const SEE_ALL_HREF = '/trade'

/**
 * One lobby carousel row (PRD 0008, lobby phase): an icon + title, a "SEE ALL"
 * link, and prev/next arrows top-right, over a horizontal scroll-snap strip of
 * poster cards. Dumb w.r.t. data — markets and loading come from `useLobby`;
 * only the local scroll/paging state lives in `useCarousel`. Cards navigate to
 * `/trade/:symbol` via `<Link>`.
 */
export function MarketCarousel({ title, icon: Icon, markets, isLoading }: MarketCarouselProps) {
  const { scrollRef, canPrev, canNext, page } = useCarousel()

  const isEmpty = !isLoading && markets.length === 0

  return (
    <section className={styles.section} aria-label={title}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <Icon className={styles.icon} size={18} aria-hidden="true" />
          <h2 className={styles.title}>{title}</h2>
          <Link className={styles.seeAll} to={SEE_ALL_HREF}>
            See all
          </Link>
        </div>
        <div className={styles.arrows}>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => page('prev')}
            disabled={!canPrev}
            aria-label={`Scroll ${title} left`}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => page('next')}
            disabled={!canNext}
            aria-label={`Scroll ${title} right`}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      {isEmpty ? (
        <p className={styles.empty}>Nothing here right now. Check back soon.</p>
      ) : (
        <div className={styles.viewport} ref={scrollRef}>
          {isLoading
            ? SKELETON_KEYS.map((key) => (
                <div key={key} className={styles.cell}>
                  <MarketCardSkeleton />
                </div>
              ))
            : markets.map((market) => (
                <Link
                  key={market.symbol}
                  className={styles.cell}
                  to={tradeHref(market.symbol)}
                  aria-label={market.symbol}
                >
                  <MarketCard symbol={market.symbol} changePct={toChangePct(market.change24hPct)} />
                </Link>
              ))}
        </div>
      )}
    </section>
  )
}
