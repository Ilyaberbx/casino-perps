import {
  parseWalletAddress,
  type Market,
  type PortfolioMetric,
  type PortfolioWindow,
  type PortfolioAccountScope,
  type WalletAddress,
} from '@/modules/shared/domain'
import type {
  PortfolioResponse,
  SpotMetaAndAssetCtxsResponse,
  SpotMetaResponse,
  UserAbstractionResponse,
  WebData2Response,
} from './gateway/sdk-types'
import {
  USDC_SYMBOL,
  USDC_TOKEN_INDEX,
  UNIT_BRIDGED_CANONICAL_SYMBOL,
} from './hyperliquid.constants'

export type HyperliquidPortfolioPeriod =
  | 'day'
  | 'week'
  | 'month'
  | 'allTime'
  | 'perpDay'
  | 'perpWeek'
  | 'perpMonth'
  | 'perpAllTime'

/**
 * Maps a (metric, window, scope) triple to the Hyperliquid period bucket key.
 * Returns null when the metric is not supported (volume has no series, only an aggregate).
 *
 * - (accountValue | pnl, 24H, all) → 'day'
 * - (accountValue | pnl, 7D, all)  → 'week'
 * - (accountValue | pnl, 30D, all) → 'month'
 * - (accountValue | pnl, AllTime, all) → 'allTime'
 * - (*, *, perps) → corresponding perp* period
 * - (perpsPnl, *, *) → perps periods regardless of scope
 * - (volume, *, *) → null (unsupported)
 */
export function mapToPeriod(
  metric: PortfolioMetric,
  window: PortfolioWindow,
  scope: PortfolioAccountScope,
): HyperliquidPortfolioPeriod | null {
  const isVolume = metric === 'volume'
  if (isVolume) return null

  const usePerps = scope === 'perps' || metric === 'perpsPnl'

  if (window === '24H') return usePerps ? 'perpDay' : 'day'
  if (window === '7D') return usePerps ? 'perpWeek' : 'week'
  if (window === '30D') return usePerps ? 'perpMonth' : 'month'
  return usePerps ? 'perpAllTime' : 'allTime'
}

/**
 * Coerce a Hyperliquid stringified numeric (e.g. "1234.5" or "-0.001") to a JS number.
 * Returns 0 for an empty/missing string. Used by readers projecting SDK responses.
 */
export function parseStringifiedNumber(value: string | undefined | null): number {
  if (value === undefined || value === null || value === '') return 0
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return 0
  return parsed
}

/**
 * Brand the SDK's `0x${string}` user address as our domain `WalletAddress`
 * (lowercased). Throws on shape/length mismatch — the SDK validates inputs
 * upstream so this is an invariant check, not a recoverable error.
 */
export function brandSdkAddress(input: `0x${string}`): WalletAddress {
  const result = parseWalletAddress(input)
  if (result.isErr()) {
    throw new Error(`unreachable: SDK returned non-conforming address ${input}`)
  }
  return result.value
}

/**
 * Canonicalize a Hyperliquid spot base-token name. Unit-bridged tokens
 * (`UBTC` = Unit Bitcoin) map to their canonical symbol (`BTC`) via the
 * curated `UNIT_BRIDGED_CANONICAL_SYMBOL` allowlist; every other name —
 * including non-Unit `U`-prefixed tokens like `UNI`/`USDC`/`USDH` — passes
 * through unchanged. See ADR-0018.
 */
export function canonicalizeUnitToken(tokenName: string): string {
  return (
    UNIT_BRIDGED_CANONICAL_SYMBOL[
      tokenName as keyof typeof UNIT_BRIDGED_CANONICAL_SYMBOL
    ] ?? tokenName
  )
}

export type SpotPriceIndex = ReadonlyMap<string, number>
export type SpotTokenSymbolByIndex = ReadonlyMap<number, string>

/**
 * Build a `tokenIndex → tokenSymbol` map from spot meta. Used to resolve
 * borrow/lend supply rows (keyed by token index) into their USD equivalent
 * via the spot price index.
 */
export function buildSpotTokenSymbolByIndex(
  meta: SpotMetaResponse,
): SpotTokenSymbolByIndex {
  const out = new Map<number, string>()
  for (const t of meta.tokens) out.set(t.index, t.name)
  return out
}

/**
 * The collateral-eligibility rule for unified / portfolio-margin accounts:
 * a spot token is perp-tradeable collateral iff it is a `collateralToken` of
 * some perp dex (the `unifiedCollateralTokenIndices` set, derived from
 * `allPerpMetas` — the default dex is USDC; HIP-3 builder dexes add stablecoins
 * like USDH/USDE/USDT0). USDC is always seeded — it is universal unified
 * collateral and stays pinned even before `allPerpMetas` / `spotMeta` resolve.
 *
 * This is the deterministic mirror of Hyperliquid's own
 * `tokenToAvailableAfterMaintenance` semantics: a volatile holding (HYPE, BTC,
 * ETH, …) is NOT any dex's collateral token, so it is excluded — exactly why
 * HL's "Available to Trade" omits it. We resolve the on-chain collateral-token
 * set rather than a hardcoded stables allowlist so newly listed HIP-3 dex
 * collaterals are picked up without a code change (and a non-stable that some
 * dex actually accepts as collateral is correctly included).
 *
 * Resolves indices to symbols against the *same* snapshot's symbol index, so
 * both come from one pull tick (no cross-source ordering race).
 */
export function resolveUnifiedCollateralSymbols(
  indices: ReadonlySet<number>,
  symbolByIndex: SpotTokenSymbolByIndex,
): ReadonlySet<string> {
  const symbols = new Set<string>([USDC_SYMBOL])
  for (const idx of indices) {
    const symbol = symbolByIndex.get(idx)
    if (symbol === undefined) continue
    symbols.add(symbol)
  }
  return symbols
}

/**
 * Build a `tokenSymbol → markPx (USD)` index by joining a `spotMetaAndAssetCtxs`
 * response. Hyperliquid's spot universe is keyed by *pair* (e.g. "PURR/USDC"),
 * not by base-token symbol — so we resolve token-symbol pricing via
 * `universe[i].tokens[0]` (base token index) → `meta.tokens[idx].name`.
 *
 * Two non-obvious joins, both confirmed against live mainnet:
 *
 * 1. **assetCtxs are indexed by the pair's `.index` (the `@N` spot id), NOT by
 *    array position.** `universe` is a compact list (delisted pairs removed)
 *    while `assetCtxs` is sparse/longer, so `ctxs[i]` mis-aligns for nearly
 *    every token (e.g. it priced UBTC at ~0 instead of ~$63k). The price is
 *    `ctxs[pair.index]`.
 * 2. **Only USDC-quoted pairs price the base token in USD.** `tokens[1]` is the
 *    quote token; a base token can also trade against non-USDC (e.g.
 *    `UBTC/<other>`), and that pair's `markPx` is not a USD value — including it
 *    would overwrite the correct USDC price (last-write-wins).
 *
 * USDC is always pinned to 1.0 and always present.
 */
export function buildSpotPriceIndex(
  response: SpotMetaAndAssetCtxsResponse,
): SpotPriceIndex {
  const [meta, ctxs] = response
  const index = new Map<string, number>()
  index.set(USDC_SYMBOL, 1)
  const tokenByIndex = new Map<number, string>()
  for (const t of meta.tokens) tokenByIndex.set(t.index, t.name)
  for (const pair of meta.universe) {
    const baseTokenIdx = pair.tokens[0]
    const quoteTokenIdx = pair.tokens[1]
    if (baseTokenIdx === undefined) continue
    const isUsdcQuoted = quoteTokenIdx === USDC_TOKEN_INDEX
    if (!isUsdcQuoted) continue
    const baseTokenName = tokenByIndex.get(baseTokenIdx)
    if (baseTokenName === undefined) continue
    const ctx = ctxs[pair.index]
    if (ctx === undefined) continue
    const price = parseStringifiedNumber(ctx.markPx ?? ctx.midPx)
    if (price === 0) continue
    index.set(baseTokenName, price)
  }
  return index
}

/**
 * Pick the bucket for a Hyperliquid portfolio period. Returns `null` when the
 * period is missing (defensive — the SDK type guarantees presence, but we project
 * defensively in case the wire shape drifts).
 */
export function pickPortfolioBucket(
  response: PortfolioResponse,
  period: HyperliquidPortfolioPeriod,
): PortfolioResponse[number][1] | null {
  for (const entry of response) {
    if (entry[0] === period) return entry[1]
  }
  return null
}

/**
 * Last value of a stringified `[timestamp, value]` series, parsed to number.
 * Returns 0 when the series is empty.
 */
export function lastSeriesValue(
  series: ReadonlyArray<readonly [number, string]>,
): number {
  if (series.length === 0) return 0
  const last = series[series.length - 1]
  if (last === undefined) return 0
  return parseStringifiedNumber(last[1])
}

const PERP_SUFFIX = '-PERP'

/** Project an HL coin name (`"ETH"`) to the domain perp symbol (`"ETH-PERP"`). */
export function toDomainPerpSymbol(hlCoin: string): string {
  return `${hlCoin}${PERP_SUFFIX}`
}

/**
 * Strip the domain `-PERP` suffix to recover the HL coin name. No-op when the
 * input is already bare.
 *
 * @deprecated Use toHlCoinFromMarket(market) instead for all new code. This
 * function only handles -PERP suffix stripping and is unaware of Spot/@N or
 * HIP-3 dex-prefixed coins.
 */
export function toHlCoin(domainSymbol: string): string {
  return domainSymbol.endsWith(PERP_SUFFIX)
    ? domainSymbol.slice(0, -PERP_SUFFIX.length)
    : domainSymbol
}

/**
 * Resolve the HL API coin name from a domain Market. Single coin-resolution
 * point for all SDK calls — replaces the perps-only toHlCoin().
 * - Perp:  'BTC-PERP' → 'BTC' (via hlCoin field or -PERP strip fallback).
 * - Spot:  'HYPE/USDC' → '@107' (must come from hlCoin; display pair ≠ HL key).
 * - HIP-3: 'xyz:AAPL' → 'xyz:AAPL' (hlCoin is already the dex-prefixed form).
 */
export function toHlCoinFromMarket(market: Market): string {
  if (market.hlCoin !== undefined) return market.hlCoin
  return toHlCoin(market.symbol)
}

/**
 * Read the USD mark price for a perp asset from `WebData2Response`. Used to
 * convert HYPE staking balances to USD (HYPE is a perp asset on Hyperliquid).
 */
export function getPerpMarkPriceUsd(
  state: WebData2Response,
  coin: string,
): number {
  const universe = state.meta.universe
  for (let i = 0; i < universe.length; i += 1) {
    if (universe[i]?.name !== coin) continue
    const ctx = state.assetCtxs[i]
    if (ctx === undefined) return 0
    return parseStringifiedNumber(ctx.markPx ?? ctx.midPx)
  }
  return 0
}

// Assumption A1: HL perpetual funding interval is exactly 8 hours at UTC 00:00,
// 08:00, 16:00 for all listed perps in scope. Risk: assets with non-8h intervals
// (e.g., prediction market tokens) would show wrong countdown.
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000

/**
 * Compute the number of seconds remaining until the next Hyperliquid perpetual
 * funding epoch (every 8 hours at UTC 00:00, 08:00, 16:00).
 *
 * Pure — depends only on `Date.now()`. Returns 0 when called exactly on an
 * epoch boundary. Suitable for a 1-second `setInterval` tick in the ticker
 * subscription.
 */
export function computeFundingCountdownSeconds(): number {
  const now = Date.now()
  const nextFunding = Math.ceil(now / EIGHT_HOURS_MS) * EIGHT_HOURS_MS
  return Math.max(0, Math.floor((nextFunding - now) / 1000))
}

/**
 * Map a tenths-of-bps integer to the percent-string format Hyperliquid's
 * `approveBuilderFee` action expects (`"0.035%"` for 35 tenths of bps).
 *
 * 1 tenth of bp = 0.001%, so divide by 1_000 and append `%`. Drops trailing
 * zeros so the result is the shortest unambiguous form (`35 → "0.035%"`,
 * `100 → "0.1%"`, `1000 → "1%"`, `0 → "0%"`). Anchored to Hyperliquid's own
 * worked example: "f: 50 means 50 tenths of a bp = 5 bps = 0.05%".
 *
 * Hyperliquid's fee resolution is one tenth of a bp, so a non-integer
 * tenths-of-bps input renders a sub-resolution percent the chain rejects as
 * "Percentage is invalid" — the original divisor was 10_000, which turned
 * 35 into "0.0035%" (= 3.5 tenths of bps) and broke approval. See ADR-0024
 * Amendment (2026-05-30).
 *
 * The divisor (1_000) is mirrored inline in `hyperliquid.constants.ts` to
 * derive `HYPERLIQUID_BUILDER[*].maxFeeRate` without importing this utility
 * (constants files are data leaves; see frontend-architecture.md). The
 * constants test asserts the two stay in sync.
 */
export function formatTenthsOfBpsAsPercentString(
  tenthsOfBps: number,
): `${string}%` {
  const TENTHS_OF_BPS_TO_PERCENT = 1_000
  return `${tenthsOfBps / TENTHS_OF_BPS_TO_PERCENT}%`
}

/**
 * Derive the app's canonical agent name for a master wallet: `agent-<last4>`.
 * Deterministic per wallet, so a re-approve from any browser targets the SAME
 * named slot — which on Hyperliquid REPLACES the existing agent of that name
 * (ADR-0036 D-1). Used by the onboarding step's default name input AND by the
 * agent bootstrap's desync resolution (to recognise a stranded agent as ours).
 */
export function deriveDefaultAgentName(primaryWalletAddress: string | null): string {
  const ADDRESS_LAST4_CHARS = 4
  if (primaryWalletAddress === null) return 'agent'
  const last4 = primaryWalletAddress.slice(-ADDRESS_LAST4_CHARS)
  return `agent-${last4}`
}

/**
 * Map a Hyperliquid account abstraction mode to the venue-agnostic
 * `isSegregated` signal (ADR-0033). `unifiedAccount`/`portfolioMargin` share one
 * Spot+Perp balance ⇒ not segregated. `default`/`disabled` are classic separate
 * Spot/Perp accounts ⇒ segregated. `dexAbstraction` is the HIP-3 axis and does
 * not unify the USDC Spot↔Perp split ⇒ segregated. `null` (mode not yet read /
 * read failed) defaults to segregated — the classic assumption, so a transient
 * failure never hides Transfer from a classic user.
 */
export function isSegregatedAccount(
  mode: UserAbstractionResponse | null,
): boolean {
  const isUnified = mode === 'unifiedAccount' || mode === 'portfolioMargin'
  return !isUnified
}
