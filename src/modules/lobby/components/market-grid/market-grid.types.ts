import type { LucideIcon } from 'lucide-react'
import type { Market } from '@/modules/shared/domain'

export interface MarketGridProps {
  title: string
  icon: LucideIcon
  markets: ReadonlyArray<Market>
  isLoading: boolean
  /** Shown when the view has loaded and has nothing in it. Per-view copy — an
   *  empty Favorites grid should say how to fill it, not "check back soon". */
  emptyMessage: string
}
