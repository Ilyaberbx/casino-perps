import type { LucideIcon } from 'lucide-react'
import type { Market } from '@/modules/shared/domain'

export interface MarketCarouselProps {
  /** Section heading, e.g. `'Hot Markets'`. */
  title: string
  /** Small section icon rendered left of the title. */
  icon: LucideIcon
  /** Markets to render as poster cards, in display order. */
  markets: ReadonlyArray<Market>
  /** When true, render a row of `MarketCardSkeleton`s instead of cards. */
  isLoading: boolean
  /** Where the "See all" link points — this section's focused grid, e.g.
   *  `/?view=hot`. `null` renders no link: the "All Markets" row is already the
   *  full remainder, so it has nowhere to go. */
  seeAllHref: string | null
}
