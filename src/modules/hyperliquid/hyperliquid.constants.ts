import type { HyperliquidNetwork } from './hyperliquid.types'

export const HYPERLIQUID_VENUE_ID = 'hyperliquid' as const
export const HYPERLIQUID_VENUE_LABEL = 'Hyperliquid' as const

export const HYPERLIQUID_DEFAULT_URLS: Readonly<
  Record<HyperliquidNetwork, { http: string; ws: string }>
> = {
  mainnet: {
    http: 'https://api.hyperliquid.xyz',
    ws: 'wss://api.hyperliquid.xyz/ws',
  },
  testnet: {
    http: 'https://api.hyperliquid-testnet.xyz',
    ws: 'wss://api.hyperliquid-testnet.xyz/ws',
  },
}

export const HYPERLIQUID_EXPLORER_BASE_URL: Readonly<Record<HyperliquidNetwork, string>> = {
  mainnet: 'https://app.hyperliquid.xyz/explorer',
  testnet: 'https://app.hyperliquid-testnet.xyz/explorer',
}

/**
 * HL's `trades` WS payload always carries a per-trade `hash` field, but the
 * majority of fills are matched off-chain — HL emits the all-zero 32-byte
 * sentinel for those. Feeding it into the explorer URL produces a dead link,
 * so the projection treats this value as "no transaction hash" and the UI
 * hides the explorer icon.
 */
export const HYPERLIQUID_ZERO_TRANSACTION_HASH = `0x${'0'.repeat(64)}` as const

/**
 * Hyperliquid allows a master account 1 unnamed + at most 3 NAMED agent (API)
 * wallets; we only ever approve named agents. When `extraAgents` reports this
 * many and none is ours, no free slot exists — approving requires replacing an
 * existing agent by re-using its exact name (ADR-0036 D-2/D-3). Sub-accounts
 * add +2 named slots each, but the app does not use sub-accounts.
 */
export const HYPERLIQUID_MAX_NAMED_AGENTS = 3

/**
 * Cloid (client order id) prefix — the leading hex digits stamped onto every
 * order we sign so our fills are recognisable as originating from this app.
 * A Hyperliquid cloid is `0x` + 32 hex chars (16 bytes); the prefix occupies
 * the leading chars and the remainder is filled with randomness by
 * `generateCloid` (see `shared/utils/generate-cloid.ts`). Single source of
 * truth (PRD decision 7).
 *
 * PLACEHOLDER: the real branded prefix has not been supplied yet. `'a99a'`
 * is a clearly-fake stand-in (4 hex chars / 2 bytes). It produces structurally
 * valid cloids so mock-venue and the order-entry UI are fully testable; swap in
 * the real value before shipping Hyperliquid signing.
 */
export const HYPERLIQUID_CLOID_PREFIX = 'a99a' as const

/**
 * Builder fee partnership — see ADR-0024.
 *
 * `feeTenthsOfBps` is the canonical value. `maxFeeRate` is derived so the two
 * cannot drift: a single number drives both the order-time `f` field and the
 * `approveBuilderFee` user-signed action's `maxFeeRate` string.
 *
 * Same builder address on mainnet and testnet — approvals are signed
 * independently per network (Hyperliquid scopes them by chain).
 *
 * Hyperliquid caps perps builder fees at 100 tenths of bps (0.1%) and spot at
 * 1000 tenths of bps (1%); 35 stays well below both.
 */
export const HYPERLIQUID_BUILDER_ADDRESS =
  '0xff9be883a670afe4c1e8dcb2fc05afb2caecd6b7' as const

export const HYPERLIQUID_BUILDER_FEE_TENTHS_OF_BPS = 35

/**
 * `maxFeeRate` is derived from `HYPERLIQUID_BUILDER_FEE_TENTHS_OF_BPS` via a
 * literal arithmetic expression — not a function call — to satisfy the
 * constants-file rule ("data leaves; no utils") while preserving the SSoT
 * invariant (only the tenths-of-bps integer is authored). 1 tenth of bp =
 * 0.001%; the divisor below is identical to the one in
 * `formatTenthsOfBpsAsPercentString` (kept in sync by the constants test).
 */
const TENTHS_OF_BPS_TO_PERCENT_DIVISOR = 1_000
const HYPERLIQUID_BUILDER_MAX_FEE_RATE =
  `${HYPERLIQUID_BUILDER_FEE_TENTHS_OF_BPS / TENTHS_OF_BPS_TO_PERCENT_DIVISOR}%` as `${string}%`

export const HYPERLIQUID_BUILDER: Readonly<
  Record<HyperliquidNetwork, {
    readonly address: `0x${string}`
    readonly feeTenthsOfBps: number
    readonly maxFeeRate: `${string}%`
  }>
> = {
  mainnet: {
    address: HYPERLIQUID_BUILDER_ADDRESS,
    feeTenthsOfBps: HYPERLIQUID_BUILDER_FEE_TENTHS_OF_BPS,
    maxFeeRate: HYPERLIQUID_BUILDER_MAX_FEE_RATE,
  },
  testnet: {
    address: HYPERLIQUID_BUILDER_ADDRESS,
    feeTenthsOfBps: HYPERLIQUID_BUILDER_FEE_TENTHS_OF_BPS,
    maxFeeRate: HYPERLIQUID_BUILDER_MAX_FEE_RATE,
  },
}

// Reconnect / heartbeat defaults per ADR-0009.
export const RECONNECT_INITIAL_BACKOFF_MS = 500
export const RECONNECT_BACKOFF_FACTOR = 2
export const RECONNECT_MAX_BACKOFF_MS = 30_000
export const RECONNECT_JITTER = 0.3

export const HEARTBEAT_INTERVAL_MS = 15_000
export const HEARTBEAT_TIMEOUT_MS = 5_000

/**
 * Per-request timeout (ms) for the Hyperliquid HTTP transport (REST info calls).
 * Matches the SDK's own default so behaviour is unchanged — set explicitly so the
 * bound is visible and intentional. Kept at 10s on purpose: the market-data
 * reader's progressive load treats a ~10s secondary-source timeout as the point a
 * degraded source (spot / HIP-3) is dropped so the perp list still renders;
 * raising it would delay that fallback. The WebSocket transport is NOT bounded by
 * this — its liveness is owned by `withReconnect`.
 */
export const HYPERLIQUID_HTTP_TIMEOUT_MS = 10_000

/**
 * Polling cadence for HTTP-only data (portfolio, userFees, delegatorSummary,
 * borrowLendUserState). Hyperliquid exposes no websocket channel for these.
 */
export const PORTFOLIO_POLL_MS = 30_000

/**
 * Polling cadence for the REST `webData2` feed. Hyperliquid REMOVED the
 * `webData2` websocket subscription in the 2026-07 network upgrade (replaced by
 * the much thinner `webData3`); the REST `/info` variant still serves the
 * identical payload. The old websocket feed only pushed every ~5s, so a 5s poll
 * is behaviour parity, and at ~12 req/min it is far inside HL's 1200 weight/min
 * per-IP REST budget.
 */
export const WEB_DATA2_POLL_MS = 5_000

/**
 * Consecutive REST `webData2` poll failures tolerated before the poller aborts
 * its `failureSignal` and hands recovery to `withReconnect`'s backoff. Single
 * blips keep serving the cached tick without surfacing a reconnect.
 */
export const WEB_DATA2_POLL_FAILURE_LIMIT = 3

/** USDC token symbol on the Hyperliquid spot universe. Always priced at $1. */
export const USDC_SYMBOL = 'USDC'

/**
 * USDC's token index in the Hyperliquid spot universe (always 0). A spot pair's
 * quote token is `universe[i].tokens[1]`; we only USD-price a base token from a
 * USDC-quoted pair so a non-USDC pair (e.g. UBTC/<other>) can't overwrite it.
 */
export const USDC_TOKEN_INDEX = 0

/** HYPE token symbol — the staking token on Hyperliquid. */
export const HYPE_SYMBOL = 'HYPE'

/** Number of trailing daily-volume entries to sum into the 14-day volume tile. */
export const FOURTEEN_DAY_VOLUME_WINDOW = 14

/**
 * Hyperliquid spot lists "Unit"-bridged assets under a `U`-prefixed token name
 * (`UBTC` = Unit Bitcoin). The reference HL UI shows them as the canonical
 * symbol (`BTC/USDC`) with the canonical icon. The mapping is NOT algorithmic
 * (`UFART → FARTCOIN`, `UUUSPX → SPX6900`) and `U` is not a strippable prefix
 * (`UNI`, `USDC`, `USDT`, `USDH` are not Unit-bridged), so canonicalization is
 * a curated allowlist keyed by the exact spot-API token `name`. Mirrors the
 * production React Native app's `WRAPPED_TOKEN_MAPPING` (U-prefixed entries).
 * See ADR-0018.
 */
export const UNIT_BRIDGED_CANONICAL_SYMBOL = {
  UBTC: 'BTC',
  UETH: 'ETH',
  USOL: 'SOL',
  UFART: 'FARTCOIN',
  UPUMP: 'PUMP',
  USPYX: 'SPX',
  UUUSPX: 'SPX6900',
  UBONK: 'BONK',
  UMOG: 'MOG',
  UENA: 'ENA',
  UXPL: 'XPL',
  UWLD: 'WLD',
  UDZ: 'DZ',
  UDOGE: 'DOGE',
  UMON: 'MON',
  UMEGA: 'MEGA',
  UZEC: 'ZEC',
  UVIRT: 'VIRTUAL',
  UWBTC: 'WBTC',
  USTETH: 'STETH',
  UUSDC: 'USDC',
  UUSDT: 'USDT',
  ULINK: 'LINK',
  UUNI: 'UNI',
  UAAVE: 'AAVE',
  UMATIC: 'MATIC',
  UPOL: 'POL',
  UARB: 'ARB',
  UOP: 'OP',
  UAVAX: 'AVAX',
  USHIB: 'SHIB',
  UPEPE: 'PEPE',
  UWIF: 'WIF',
  UTRUMP: 'TRUMP',
  UMELANIA: 'MELANIA',
} as const
