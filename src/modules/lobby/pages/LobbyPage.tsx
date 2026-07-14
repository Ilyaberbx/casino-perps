import { HeroBanner } from '../components/hero-banner'
import { MarketCarousel } from '../components/market-carousel'
import { MarketGrid } from '../components/market-grid'
import { useLobby } from '../hooks/use-lobby'
import { FOCUSED_VIEW_META, SECTION_ICON, SECTION_SEE_ALL_HREF } from './lobby-page.constants'
import styles from './lobby-page.module.css'

/**
 * The `/` lobby (PRD 0008 D15). What it renders depends on the `?view=` param
 * the left rail writes:
 *
 * - `all` — and a bare `/`, and any unrecognised value — is the full lobby: the
 *   hero banner over the Hot Markets / New Listings / All Markets carousels.
 * - `hot` / `new` / `favorites` / `recent` are focused views: a single titled
 *   grid, no hero.
 *
 * Smart data comes from `useLobby` (venue `marketData` port, plus the favorites
 * and recent-markets stores); the shell renders the LIVE WINS ticker above this
 * outlet, so the page never mounts one itself.
 */
export function LobbyPage() {
  const { isLoading, content } = useLobby()

  if (content.kind === 'focused') {
    const meta = FOCUSED_VIEW_META[content.view]
    return (
      <div className={styles.page} data-testid="lobby-page" data-view={content.view}>
        <MarketGrid
          title={meta.title}
          icon={meta.icon}
          markets={content.markets}
          isLoading={isLoading}
          emptyMessage={meta.emptyMessage}
        />
      </div>
    )
  }

  return (
    <div className={styles.page} data-testid="lobby-page" data-view="all">
      <HeroBanner />
      {content.sections.map((section) => (
        <MarketCarousel
          key={section.id}
          title={section.title}
          icon={SECTION_ICON[section.id]}
          seeAllHref={SECTION_SEE_ALL_HREF[section.id]}
          markets={section.markets}
          isLoading={isLoading}
        />
      ))}
    </div>
  )
}
