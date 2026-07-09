// Pure projection + URL builders for the PnL card. No React, no IO, no module
// state — every function is a pure mapping, so the mappers and link/tweet
// builders are unit-testable in isolation.

import type { Fill, Market, PerpPositionSnapshot, Side } from '@/modules/shared/domain'
import { formatUsd, formatTokenAmount } from '@/modules/shared/utils/format-number'
import { formatPnlPct, pnlPctSign } from '@/modules/shared/utils/format-pnl'
import { parseHip3Symbol } from '@/modules/shared/utils/hip3-symbol'
import {
  resolveHlFallbackUrl,
  resolveSpotBareIconUrl,
  resolveTvIconUrl,
} from '@/modules/shared/utils/resolve-market-icon-url'
import { resolveVenueIconSources } from '@/modules/shared/components/venue-icon'
import type {
  CollectibleKey,
  PnlCardArtSelection,
  PnlCardContext,
  PnlCardSide,
  PnlCardView,
  StepDirection,
} from './pnl-card.types'
import {
  ART_THEMES,
  BRAND_WORDMARK,
  MARKET_DEEP_LINK_PREFIX,
  MASCOTS,
  PLANETS,
  TELEGRAM_SHARE_BASE,
  X_INTENT_BASE,
} from './pnl-card.constants'

/** The `CARD_ART` key for an art selection (`saturn-dino-dark`). */
export function collectibleKeyOf(selection: PnlCardArtSelection): CollectibleKey {
  return `${selection.planet}-${selection.mascot}-${selection.theme}`
}

/**
 * The collectible art keys reachable from `selection` in a single picker step:
 * the planet ring ∪ the mascot ring ∪ the theme ring for the *current*
 * selection (deduped — the current selection sits in all three rings). This is
 * the scoped warm set the modal primes on open (~11 keys) — never the full 48,
 * which would be a ~40 MB fetch storm queued ahead of the two images the modal
 * actually needs.
 */
export function reachableArtKeys(selection: PnlCardArtSelection): CollectibleKey[] {
  const planetRing = PLANETS.map((planet) => collectibleKeyOf({ ...selection, planet }))
  const mascotRing = MASCOTS.map((mascot) => collectibleKeyOf({ ...selection, mascot }))
  const themeRing = ART_THEMES.map((theme) => collectibleKeyOf({ ...selection, theme }))
  return [...new Set([...planetRing, ...mascotRing, ...themeRing])]
}

/**
 * The element `dir` steps away from `current` in `ring`, wrapping around both
 * ends (`(indexOf + dir + len) % len`). Callers always pass a ring member; a
 * non-member (`indexOf === -1`) falls back to index 0 so the result stays a
 * valid ring element rather than `undefined`.
 */
export function stepRing<T>(ring: ReadonlyArray<T>, current: T, dir: StepDirection): T {
  const currentIndex = Math.max(ring.indexOf(current), 0)
  const nextIndex = (currentIndex + dir + ring.length) % ring.length
  return ring[nextIndex]
}

/**
 * Ordered icon URLs to inline into the exported PNG, CORS-capable source first.
 * `modern-screenshot` can only bake an image whose bytes it can read — and only
 * TradingView's CDN sends `Access-Control-Allow-Origin`. Hyperliquid's icon CDN
 * has no CORS, so its URLs can render in a live `<img>` but never inline into
 * the capture; they land last as best-effort. A market with no TV logoid yields
 * only HL URLs → nothing inlinable → the card falls back to the letter
 * placeholder (which captures cleanly) instead of a blank box. Full HL
 * coin-correctness on the PNG would need a same-origin icon proxy (server work).
 */
export function cardIconCandidates(market: Market): string[] {
  const tvUrl = resolveTvIconUrl(market)
  const hlUrl = resolveHlFallbackUrl(market)
  const spotBareUrl = resolveSpotBareIconUrl(market)
  const present = [tvUrl, hlUrl, spotBareUrl].filter((url): url is string => url !== null)
  return present.filter((url, index) => present.indexOf(url) === index)
}

/** Defaults for the identity/venue context — keeps the mappers callable bare in
 *  tests while production threads the real handle + venue + market through. */
function resolveContext(context: Partial<PnlCardContext>): {
  handle: string | null
  venueLabel: string
  venueIconSrc: string | null
  market: PnlCardContext['market']
} {
  const { handle = null, venueId = '', venueLabel = '', market = null } = context
  // The shared util owns the `:network` base-id rule (full id then bare prefix).
  const venueIconSrc = resolveVenueIconSources(venueId)
  return { handle, venueLabel, venueIconSrc, market }
}

/** App-relative deep link that re-opens the traded market. */
export function marketDeepLinkPath(symbol: string): string {
  return `${MARKET_DEEP_LINK_PREFIX}${symbol}`
}

/**
 * Resolve the long/short world for a closed `Fill`. The venue `direction` label
 * ('Close Long' / 'Close Short') is the primary signal; when it's absent or
 * unrecognized, fall back to the close mechanics — a closing **sell** closes a
 * long, a closing **buy** closes a short. Best-effort, since a bare `Fill`
 * carries no explicit position side.
 */
export function sideFromDirection(direction: string | undefined, side: Side): PnlCardSide {
  const label = direction ?? ''
  const saysShort = /short/i.test(label)
  const saysLong = /long/i.test(label)
  if (saysShort) return 'short'
  if (saysLong) return 'long'
  return side === 'sell' ? 'long' : 'short'
}

/** Project an open (or just-closed) position snapshot into the full card view. */
export function fromPositionSnapshot(
  position: PerpPositionSnapshot,
  options: Partial<PnlCardContext> & { realized?: boolean } = {},
): PnlCardView {
  const { displaySymbol } = parseHip3Symbol(position.symbol)
  const { handle, venueLabel, venueIconSrc, market } = resolveContext(options)
  return {
    side: position.side,
    mode: 'full',
    symbol: position.symbol,
    displaySymbol,
    leverageLabel: `${position.leverage}x`,
    heroPctLabel: formatPnlPct(position.roePct),
    heroUsdLabel: formatUsd(position.unrealizedPnlUsd, { signed: true }),
    heroSign: pnlPctSign(position.unrealizedPnlUsd),
    entryPriceLabel: formatTokenAmount(position.entryPrice),
    markPriceLabel: formatTokenAmount(position.markPrice),
    markRowLabel: 'Mark',
    realizedBadge: options.realized === true ? 'Realized' : null,
    deepLinkPath: marketDeepLinkPath(position.symbol),
    handle,
    venueLabel,
    venueIconSrc,
    market,
  }
}

/**
 * Reconstruct the entry price of the closed portion from the fill arithmetic:
 * `closedPnl = (exit − entry) × size` for a long, negated for a short — so
 * `entry = exit ∓ closedPnl / size`. `closedPnl` excludes the venue fee, so
 * this is the true average entry of what the fill closed. Returns `null` when
 * `closedPnl` is absent or the arithmetic degenerates (zero size, non-finite
 * or non-positive result).
 */
export function deriveClosedFillEntry(
  side: PnlCardSide,
  exitPrice: number,
  size: number,
  closedPnl: number | undefined,
): number | null {
  if (closedPnl === undefined) return null
  if (size <= 0) return null
  const perUnitPnl = closedPnl / size
  const entry = side === 'long' ? exitPrice - perUnitPnl : exitPrice + perUnitPnl
  const isUsableEntry = Number.isFinite(entry) && entry > 0
  return isUsableEntry ? entry : null
}

/**
 * Project a closed-trade `Fill` into the degraded card view. A `Fill` carries
 * no entry price or margin basis directly, but the entry of the closed portion
 * is recoverable from the fill arithmetic (`deriveClosedFillEntry`) — so when
 * `closedPnl` is present the card shows the derived ENTRY row and a realized
 * PnL% on the closed notional (unleveraged — a fill has no margin basis),
 * which also enables the %↔$ hero toggle. When `closedPnl` is absent (or the
 * arithmetic degenerates) both stay `null`: $-only hero, no toggle, no entry.
 */
export function fromClosedFill(fill: Fill, context: Partial<PnlCardContext> = {}): PnlCardView {
  const realizedPnl = fill.closedPnl ?? 0
  const { displaySymbol } = parseHip3Symbol(fill.symbol)
  const { handle, venueLabel, venueIconSrc, market } = resolveContext(context)
  const side = sideFromDirection(fill.direction, fill.side)
  const entryPrice = deriveClosedFillEntry(side, fill.price, fill.size, fill.closedPnl)
  const heroPctLabel =
    entryPrice !== null ? formatPnlPct((realizedPnl / (entryPrice * fill.size)) * 100) : null
  return {
    side,
    mode: 'degraded',
    symbol: fill.symbol,
    displaySymbol,
    leverageLabel: null,
    heroPctLabel,
    heroUsdLabel: formatUsd(realizedPnl, { signed: true }),
    heroSign: pnlPctSign(realizedPnl),
    entryPriceLabel: entryPrice !== null ? formatTokenAmount(entryPrice) : null,
    markPriceLabel: formatTokenAmount(fill.price),
    markRowLabel: 'Exit',
    realizedBadge: 'Realized',
    deepLinkPath: marketDeepLinkPath(fill.symbol),
    handle,
    venueLabel,
    venueIconSrc,
    market,
  }
}

/** Absolute, copy-pasteable link to the traded market. */
export function buildShareLink(view: PnlCardView, origin: string): string {
  return `${origin}${view.deepLinkPath}`
}

/** Tweet body: hero figure + side + symbol + brand. */
export function buildXIntentText(view: PnlCardView): string {
  const hero = view.heroPctLabel ?? view.heroUsdLabel
  const sideLabel = view.side === 'long' ? 'LONG' : 'SHORT'
  return `${hero} ${sideLabel} ${view.displaySymbol} on ${BRAND_WORDMARK}`
}

/** X web-intent URL: prefilled text + the market deep link (image attached manually). */
export function buildXIntentUrl(view: PnlCardView, origin: string): string {
  const text = encodeURIComponent(buildXIntentText(view))
  const url = encodeURIComponent(buildShareLink(view, origin))
  return `${X_INTENT_BASE}?text=${text}&url=${url}`
}

/** Telegram share URL: same text + market link (image attached manually). */
export function buildTelegramShareUrl(view: PnlCardView, origin: string): string {
  const url = encodeURIComponent(buildShareLink(view, origin))
  const text = encodeURIComponent(buildXIntentText(view))
  return `${TELEGRAM_SHARE_BASE}?url=${url}&text=${text}`
}

/** Filename for the downloaded PNG (`pnl-BTC-PERP.png`, `:` → `-` for filesystems). */
export function exportFileName(view: PnlCardView): string {
  const safeSymbol = view.symbol.replace(/[^A-Za-z0-9-]+/g, '-')
  return `pnl-${safeSymbol}.png`
}
