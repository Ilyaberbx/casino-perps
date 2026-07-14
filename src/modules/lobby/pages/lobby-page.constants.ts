import { Flame, History, LayoutGrid, Sparkles, Star } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { FocusedLobbyView, LobbySectionId } from '../lobby.types'

export const SECTION_ICON: Record<LobbySectionId, LucideIcon> = {
  hot: Flame,
  new: Sparkles,
  all: LayoutGrid,
}

/**
 * Title / icon / empty copy per focused view. Kept here rather than in the hook
 * so `useLobby` stays free of JSX and icon imports (smart hook + dumb component).
 *
 * The icons intentionally duplicate the left rail's (`left-rail.constants.ts`):
 * the rail lives in `app/` and cannot reach into the lobby's private page
 * constants, and the lobby must not import `app/`. Two repeated lucide imports
 * is the right trade — do not lift an icon registry into `shared/` for this.
 */
export const FOCUSED_VIEW_META: Record<
  FocusedLobbyView,
  { title: string; icon: LucideIcon; emptyMessage: string }
> = {
  hot: {
    title: 'Hot Markets',
    icon: Flame,
    emptyMessage: 'No hot markets right now. Check back soon.',
  },
  new: {
    title: 'New Listings',
    icon: Sparkles,
    emptyMessage: 'No new listings right now. Check back soon.',
  },
  favorites: {
    title: 'Favorites',
    icon: Star,
    emptyMessage: 'Star a market to see it here.',
  },
  recent: {
    title: 'Recent',
    icon: History,
    emptyMessage: 'Markets you visit will appear here.',
  },
}

/**
 * Where each carousel's "See all" points. Hot and New now have a real
 * destination — their own focused grid. "All Markets" is already the whole
 * remainder on this page, so it has nowhere to go and renders no link.
 */
export const SECTION_SEE_ALL_HREF: Record<LobbySectionId, string | null> = {
  hot: '/?view=hot',
  new: '/?view=new',
  all: null,
}
