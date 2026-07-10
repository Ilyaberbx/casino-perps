import { Flame, LayoutGrid, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { HeroBanner } from '../components/hero-banner'
import { MarketCarousel } from '../components/market-carousel'
import { useLobby } from '../hooks/use-lobby'
import type { LobbySectionId } from '../lobby.types'
import styles from './lobby-page.module.css'

const SECTION_ICON: Record<LobbySectionId, LucideIcon> = {
  hot: Flame,
  new: Sparkles,
  all: LayoutGrid,
}

/**
 * The `/` lobby (PRD 0008 D15): hero banner over the Hot Markets / New Listings
 * / All Markets carousels. Smart data comes from `useLobby` (venue `marketData`
 * port); the shell renders the LIVE WINS ticker above this outlet, so the page
 * never mounts one itself.
 */
export function LobbyPage() {
  const { isLoading, sections } = useLobby()

  return (
    <div className={styles.page} data-testid="lobby-page">
      <HeroBanner />
      {sections.map((section) => (
        <MarketCarousel
          key={section.id}
          title={section.title}
          icon={SECTION_ICON[section.id]}
          markets={section.markets}
          isLoading={isLoading}
        />
      ))}
    </div>
  )
}
