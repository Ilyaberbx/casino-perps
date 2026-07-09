// Static data for the shareable PnL card (v2). Export geometry, brand text, the
// share-surface bases, the collectible art axes, and the 48 bundled composite
// backgrounds. No logic — the pure builders in `pnl-card.utils.ts` and the
// presentational `PnlCard` consume these.

import type {
  CollectibleKey,
  PnlCardArtSelection,
  PnlCardArtTheme,
  PnlCardMascot,
  PnlCardPlanet,
  PnlCardSide,
} from './pnl-card.types'

/** Landscape share-card geometry — matches the 2160×1360 collectible art (27:17). */
export const EXPORT_WIDTH = 1080
export const EXPORT_HEIGHT = 680
/** Device-scale factor for a crisp @2x PNG (2160×1360 output — pixel-exact with the art). */
export const EXPORT_SCALE = 2

/**
 * The eight planets, ordered by distance from the sun — the order the planet
 * stepper walks. Astronomical order reads naturally and keeps the ring stable.
 */
export const PLANETS: ReadonlyArray<PnlCardPlanet> = [
  'mercury',
  'venus',
  'earth',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
] as const

/** The three collectible mascots — the order the mascot stepper walks. */
export const MASCOTS: ReadonlyArray<PnlCardMascot> = ['bug', 'cat', 'dino'] as const

/** The two art themes — matches the `-dark` / `-light` PNG suffixes. */
export const ART_THEMES: ReadonlyArray<PnlCardArtTheme> = ['dark', 'light'] as const

/** Stepper captions (Title Case) — the baked art carries its own all-caps tag,
 *  these label the picker controls only. */
export const PLANET_LABELS: Record<PnlCardPlanet, string> = {
  mercury: 'Mercury',
  venus: 'Venus',
  earth: 'Earth',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  uranus: 'Uranus',
  neptune: 'Neptune',
}

export const MASCOT_LABELS: Record<PnlCardMascot, string> = {
  bug: 'Bug',
  cat: 'Cat',
  dino: 'Dino',
}

/** First-ever-open default before any persisted pick exists (theme is overridden
 *  by the app theme at seed time — see the modal hook). */
export const DEFAULT_ART_SELECTION: PnlCardArtSelection = {
  planet: 'saturn',
  mascot: 'dino',
  theme: 'dark',
}

/**
 * The 48 bundled composite backgrounds, keyed `${planet}-${mascot}-${theme}`.
 * Loaded via `import.meta.glob` (eager, resolved to URLs) so all combinations are
 * same-origin and safe for `modern-screenshot` to inline at capture time. The
 * filenames already are the key (`saturn-dino-light.png`). The art carries the
 * brand handle + `MASCOT × PLANET` collectible tag; the card overlays only the
 * live trade data on the empty left/bottom region.
 */
const artModules = import.meta.glob('../../../../assets/pnl-card/collectibles/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

export const CARD_ART: Record<CollectibleKey, string> = Object.fromEntries(
  Object.entries(artModules).map(([path, url]) => [
    path.slice(path.lastIndexOf('/') + 1, -'.png'.length),
    url,
  ]),
) as Record<CollectibleKey, string>

/** localStorage key for the persisted art picks (browser-global, not per-user). */
export const ART_PREFS_STORAGE_KEY = 'pnl-card-art-prefs'

/** Brand wordmark — still used to compose the tweet/share text. */
export const BRAND_WORDMARK = 'INVADER'

/** X (Twitter) web-intent compose endpoint. */
export const X_INTENT_BASE = 'https://twitter.com/intent/tweet'

/** Telegram web "share a URL" endpoint (text + link only — no image attach). */
export const TELEGRAM_SHARE_BASE = 'https://t.me/share/url'

/**
 * Deep-link prefix for a market. The trading page reads `?market=hl:<symbol>`
 * and lives at `/trade` (root `/` redirects and drops the query), so the link
 * must target `/trade` directly. Mirrors `formatMarketParam` in
 * `trading/.../selected-market-provider.utils.ts` — kept here because the
 * lint boundary forbids `shared/` importing `trading/`.
 */
export const MARKET_DEEP_LINK_PREFIX = '/trade?market=hl:'

/** Side no longer selects the background; kept for the LONG/SHORT pill accent. */
export const SIDE_LABELS: Record<PnlCardSide, string> = {
  long: 'LONG',
  short: 'SHORT',
}

/**
 * Pixel direction arrows for the side pill — up for long, down for short.
 * Stepped triangles keep the sprite-icon language (integer geometry, no rounded
 * vector glyph). `#` paints in `currentColor`; viewBox is `0 0 5 3`.
 */
export const ARROW_UP = ['..#..', '.###.', '#####'] as const
export const ARROW_DOWN = ['#####', '.###.', '..#..'] as const
export const ARROW_COLS = 5
export const ARROW_ROWS = 3
