// @ts-nocheck
/**
 * Harvest TradingView `logoid`s for the app's asset universe and (re)generate
 * `src/modules/shared/constants/tradingview-logoid-map.constants.ts`.
 *
 * This script is BUILD TOOLING — it lives outside `src/`, so the client folder
 * taxonomy and the no-`console` rule do not apply here. It talks to two
 * unofficial TradingView endpoints, which respond 200 only with browser-shaped
 * headers (see HEADERS below):
 *   - symbol search: https://symbol-search.tradingview.com/symbol_search/
 *   - image CDN:     https://s3-symbol-logo.tradingview.com/{logoid}.svg
 *
 * Coverage strategy per asset class:
 *   - crypto      → logoid is deterministic: `crypto/XTVC{SYMBOL}`. We construct
 *                   it and keep it only if the image CDN returns 200. No search,
 *                   so no ticker-collision risk for the whole HL universe.
 *   - non-crypto  → broad symbol search (NO `type` filter), skipping any hit
 *                   whose `type` is a crypto-exchange perp/spot (`swap`/`spot`),
 *                   then take the first remaining hit with a logoid the image
 *                   CDN serves. A `type=stock` filter is too narrow — it drops
 *                   depositary receipts (`dr`: TSM, SMSN) and ETFs (`fund`: EWY,
 *                   EWJ), which is why those rendered letter chips.
 *   - fx          → handled by overrides.json (country-flag logoids).
 *
 * The non-crypto universe is enumerated DYNAMICALLY from Hyperliquid's HIP-3
 * builder dexes (perpDexs → per-dex `meta`), so the map keys match the app's
 * real `baseAsset` exactly (the `xyz:HYNDAI` segment, not a hand-typed
 * `HYUNDAI`). The editorial Minara non-crypto lists are unioned in for
 * suggestion-only assets that aren't tradeable on HL.
 *
 * Every candidate logoid is verified against the image CDN before it lands in
 * the map. `overrides.json` is merged LAST and wins.
 *
 * Run: `pnpm --filter @perps/client harvest:icons`
 */
import { writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_FILE = join(
  HERE,
  '..',
  'src',
  'modules',
  'shared',
  'constants',
  'tradingview-logoid-map.constants.ts',
)
const OVERRIDES_FILE = join(HERE, 'tv-logoid-overrides.json')

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Origin: 'https://www.tradingview.com',
  Referer: 'https://www.tradingview.com/',
  'Accept-Language': 'en-US,en;q=0.9',
}

const SEARCH_BASE = 'https://symbol-search.tradingview.com/symbol_search/'
const IMG_BASE = 'https://s3-symbol-logo.tradingview.com'
const HL_INFO = 'https://api.hyperliquid.xyz/info'
const THROTTLE_MS = 150

// ── Catalog input (mirrors trading.constants.ts / minara-catalog.constants.ts).
// Editorial data — keep in sync with the canonical TS lists when they change.
const MINARA_CRYPTO = `BTC HYPE ETH SOL ZEC XRP NEAR LIT WLD AAVE XMR ASTER XPL NBIS SUI LINK TAO ZRO BNB MON VVV DOGE PUMP LTC ADA ENA AVAX PAXG FARTCOIN TRX BB UNI WDC WLFI TRUMP XLM JTO ONDO BCH AERO GRASS SPX ARM PENDLE PURR CRV FET MEGA VIRTUAL JUP CC ETHFI LDO PENGU APT WIF DOT ARB CFX HBAR MORPHO DYDX INJ AVGO OP EIGEN IBM ATOM MNT BIO FIL STRK TIA CHIP STBL MANTA IP IMX NOK STABLE ALGO RUNE POL ICP SKY SYRUP LINEA ENS HEMI RENDER APEX SEI DASH BERA MET AR ASML ETC KAS AZTEC PYTH DELL SMH KAITO POPCAT NIL NOW APE ZK CAKE W 2Z IO MELANIA COMP NXPC REZ ZORA AVNT S SNX GRIFFAIN LAYER BSV STX BLUR MEME TRB EWT ORDI VINE XAI ZETA MERL MINA AXS MOODENG FOGO BRETT SAND NEO AIXBT ZEN GMX MOVE UMA GALA ALT BABY GOAT TURBO NOT PROVE SAGA DYM INIT GMT 0G SKR PNUT BOME IOTA RESOLV GBP ACE ME SUSHI GAS HMSTR USUAL WCT SUPER SOPH HYPER BIGTIME ANIME BANANA RSR YGG ARK POLYX CELO DOOD PEOPLE TNSR EBAY`.split(/\s+/)
const STOCKS = `MU NVDA SKHX GOOGL SNDK MRVL INTC DRAM MSFT CRCL TSLA MSTR META SMSN AMZN AMD HOOD ORCL PLTR CRWV AAPL LITE RKLB PURRDAT EWY TSM COIN HIMS BABA LLY NFLX GME HYUNDAI RIVN URNM USAR EWJ ZM BIRD XLE COST DKNG EWZ BX`.split(/\s+/)
const COMMODITIES = `CL GOLD BRENTOIL SILVER COPPER NATGAS PLATINUM PALLADIUM`.split(/\s+/)
const INDICES = `SP500 XYZ100 JP225 KR200`.split(/\s+/)
const FX = `JPY EUR`.split(/\s+/)
const PRE_IPO = `SPCX CBRS QNT`.split(/\s+/)

// TradingView hit `type`s that denote a crypto-exchange perp/spot listing.
// These pollute searches for real equities/indices (e.g. SKHX's only hit is a
// Pionex `swap`), so we skip them when resolving a non-crypto symbol.
const CRYPTO_POLLUTION_TYPES = new Set(['swap', 'spot'])

// Symbols a broad search can only ever resolve to a wrong/irrelevant company
// (fuzzy name matches) and that have no canonical logo — force the letter
// placeholder rather than a misleading icon. USBOND→Upbound (rent-a-center),
// INFOTECH→Aditya Infotech, SEMIS→SMIS Corp, BTCD (BTC-dominance)→a random ETP.
const NEVER_MAP = new Set(['USBOND', 'INFOTECH', 'SEMIS', 'BTCD'])

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Strip a single leading k-multiplier (kPEPE → PEPE); keep digits (0G stays). */
function cryptoStem(symbol) {
  return symbol.replace(/^k([A-Z])/, '$1').toUpperCase()
}

async function imageExists(logoid) {
  const res = await fetch(`${IMG_BASE}/${logoid}.svg`, { headers: HEADERS })
  const isSvg = (res.headers.get('content-type') ?? '').includes('image/svg')
  return res.ok && isSvg
}

/** Strip TV's `<em>` highlight tags from a hit field and uppercase it. */
function normalizeHitSymbol(raw) {
  return String(raw ?? '').replace(/<[^>]+>/g, '').toUpperCase()
}

/**
 * Resolve a non-crypto symbol's logoid via a broad (un-typed) search. Walks the
 * hits in TV's own relevance order and returns the first logoid the image CDN
 * actually serves, accepting every real listing type (`stock`, `dr`, `fund`,
 * `index`, `commodity`, `futures`). Three guards keep it from picking a
 * wrong-but-servable logo:
 *
 * - skip crypto-exchange perp/spot pollution (`swap`/`spot`),
 * - skip `country/*` flag logoids — those belong to FX overrides only, never a
 *   real equity/index (e.g. VIX's first hit is `country/US`),
 * - require the hit's ticker to EQUAL the query, so a fuzzy name match
 *   (USBOND→Upbound, INFOTECH→Aditya Infotech, SEMIS→SMIS Corp) is rejected
 *   rather than stamped onto the symbol.
 */
async function broadSearchLogoid(symbol) {
  const url = `${SEARCH_BASE}?text=${encodeURIComponent(symbol)}&hl=1`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) return null
  const hits = await res.json()
  const query = symbol.toUpperCase()
  for (const hit of hits) {
    const hasLogoid = typeof hit.logoid === 'string' && hit.logoid.length > 0
    if (!hasLogoid) continue
    if (CRYPTO_POLLUTION_TYPES.has(hit.type)) continue
    if (hit.logoid.startsWith('country/')) continue
    if (normalizeHitSymbol(hit.symbol) !== query) continue
    if (await imageExists(hit.logoid)) return hit.logoid
  }
  return null
}

/**
 * Enumerate every HIP-3 base symbol from Hyperliquid's builder dexes. Each dex's
 * `meta.universe[].name` is `dex:ASSET` (e.g. `xyz:HYNDAI`); we return the bare
 * `ASSET` segment, which is exactly the app's `baseAsset` (see
 * `market-data-reader.ts` — `hlCoin.slice(indexOf(':') + 1)`).
 */
async function fetchHip3Symbols() {
  const dexs = await (await fetch(HL_INFO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'perpDexs' }),
  })).json()

  const symbols = new Set()
  for (const dex of dexs) {
    const dexName = dex && typeof dex.name === 'string' ? dex.name : ''
    if (dexName.length === 0) continue
    const meta = await (await fetch(HL_INFO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'meta', dex: dexName }),
    })).json()
    for (const m of meta.universe ?? []) {
      const name = String(m.name)
      const segment = name.slice(name.indexOf(':') + 1).toUpperCase()
      if (segment.length > 0) symbols.add(segment)
    }
    await sleep(THROTTLE_MS)
  }
  return [...symbols]
}

async function fetchHlUniverse() {
  const symbols = new Set()
  const meta = await (await fetch(HL_INFO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'meta' }),
  })).json()
  for (const m of meta.universe ?? []) symbols.add(String(m.name).toUpperCase())

  const spot = await (await fetch(HL_INFO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'spotMeta' }),
  })).json()
  for (const t of spot.tokens ?? []) symbols.add(String(t.name).toUpperCase())
  return [...symbols]
}

async function main() {
  const overrides = JSON.parse(await readFile(OVERRIDES_FILE, 'utf8'))

  // Build the work list. Crypto = Minara crypto ∪ live HL main perp/spot
  // universe (deterministic XTVC logoid). Non-crypto = editorial Minara lists ∪
  // the live HIP-3 builder-dex universe (broad search). A symbol that is crypto
  // (BTC/ETH/SOL also appear in HIP-3 dexes) stays crypto — we don't reprocess
  // it, so it keeps the crypto logo, never an equity look-alike.
  const hlUniverse = await fetchHlUniverse()
  const hip3Symbols = await fetchHip3Symbols()
  const cryptoSet = new Set([...MINARA_CRYPTO, ...hlUniverse].map((s) => s.toUpperCase()))

  const editorialNonCrypto = [...STOCKS, ...COMMODITIES, ...INDICES, ...PRE_IPO]
  // NOT filtered against cryptoSet: tokenized equities (TSLA, NVDA, AAPL…) list
  // in the HL spot/main universe AND a HIP-3 dex, so they are in BOTH sets. The
  // per-symbol resolution below skips the crypto namespace for these (see
  // `editorialEquitySet`) and broad-searches the equity — so BTC keeps its
  // crypto logo while TSLA/COIN/MU get the company logo, never an XTVC coin.
  const nonCryptoSet = new Set(
    [...editorialNonCrypto, ...hip3Symbols].map((s) => s.toUpperCase()),
  )
  // Editorial equities/commodities/indices/pre-IPO are NEVER crypto, even when
  // the same ticker also has a `crypto/XTVC{SYM}` logo (COIN, MU, MSTR, META,
  // HOOD…). Without this, crypto-first would stamp them with a coin logo. HIP-3
  // dex symbols are intentionally excluded here — a HIP-3 ticker that is also a
  // real crypto coin should still prefer its crypto logo.
  const editorialEquitySet = new Set(editorialNonCrypto.map((s) => s.toUpperCase()))

  const allSymbols = new Set([...cryptoSet, ...nonCryptoSet])
  // FX intentionally omitted from search — resolved via overrides (flags).

  const map = {}
  let attempted = 0
  let resolved = 0
  const misses = []

  for (const symbol of allSymbols) {
    if (symbol in overrides) continue // override wins; counted later
    if (NEVER_MAP.has(symbol)) continue // force the letter placeholder
    attempted += 1
    let logoid = null

    // Crypto wins when the deterministic logo exists, so a coin that also lists
    // on a HIP-3 dex keeps its crypto icon rather than an equity look-alike.
    // Editorial equities are excluded — they must never resolve to an XTVC coin.
    const isCryptoCandidate = cryptoSet.has(symbol) && !editorialEquitySet.has(symbol)
    if (isCryptoCandidate) {
      const candidate = `crypto/XTVC${cryptoStem(symbol)}`
      if (await imageExists(candidate)) logoid = candidate
    }

    // Fall through to a broad equity/index/commodity search for any non-crypto
    // candidate that did not resolve as crypto (tokenized equities, HIP-3 names).
    const needsBroadSearch = logoid === null && nonCryptoSet.has(symbol)
    if (needsBroadSearch) logoid = await broadSearchLogoid(symbol)

    if (logoid) {
      map[symbol] = logoid
      resolved += 1
    } else {
      misses.push(symbol)
    }
    await sleep(THROTTLE_MS)
  }

  // Overrides win and are added unconditionally (verify them too).
  let overrideCount = 0
  for (const [symbol, logoid] of Object.entries(overrides)) {
    const ok = await imageExists(logoid)
    if (!ok) {
      misses.push(`${symbol}(override→${logoid} MISSING)`)
      continue
    }
    map[symbol] = logoid
    overrideCount += 1
    await sleep(THROTTLE_MS)
  }

  const sorted = Object.keys(map)
    .sort()
    .map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(map[k])},`)
    .join('\n')

  const banner = `/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: pnpm --filter @perps/client harvest:icons
 * Source: scripts/harvest-tv-logoids.mjs (+ scripts/tv-logoid-overrides.json).
 *
 * Maps an UPPERCASE asset symbol to its TradingView \`logoid\`. The icon
 * resolver builds \`https://s3-symbol-logo.tradingview.com/{logoid}.svg\` from
 * it. Symbols absent here fall through to the Hyperliquid CDN (crypto) or the
 * letter placeholder — see resolve-market-icon-url.ts.
 */
export const TRADINGVIEW_LOGOID_MAP = {
${sorted}
} as const
`

  await writeFile(OUT_FILE, banner, 'utf8')
  console.log(
    `attempted=${attempted} resolved=${resolved} overrides=${overrideCount} ` +
      `total=${Object.keys(map).length} misses=${misses.length}`,
  )
  console.log('MISSES:', misses.join(', '))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
