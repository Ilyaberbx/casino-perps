import {
  COMMODITIES_SYMBOLS,
  FX_SYMBOLS,
  INDICES_SYMBOLS,
  PRE_IPO_SYMBOLS,
  STOCKS_SYMBOLS,
} from '../../trading.constants'

/**
 * Minara's crypto markets (186), scraped 1:1 from the Minara market browser
 * (verification artifact: `screenshots/minara-catalog-final.json`; the six
 * category lists partition the 247-market universe exactly). Crypto is the
 * default category in `getMarketCategory`, but the offerable universe still
 * needs the explicit list — these are the symbols themselves, in Minara order.
 * See `docs/adr/0062-minara-market-catalog.md`.
 */
export const MINARA_CRYPTO_SYMBOLS = [
  'BTC', 'HYPE', 'ETH', 'SOL', 'ZEC', 'XRP', 'NEAR', 'LIT', 'WLD', 'AAVE',
  'XMR', 'ASTER', 'XPL', 'NBIS', 'SUI', 'LINK', 'TAO', 'ZRO', 'BNB', 'MON',
  'VVV', 'DOGE', 'PUMP', 'LTC', 'ADA', 'ENA', 'AVAX', 'PAXG', 'FARTCOIN', 'TRX',
  'BB', 'UNI', 'WDC', 'WLFI', 'TRUMP', 'XLM', 'JTO', 'ONDO', 'BCH', 'AERO',
  'GRASS', 'SPX', 'ARM', 'PENDLE', 'PURR', 'CRV', 'FET', 'MEGA', 'VIRTUAL', 'JUP',
  'CC', 'ETHFI', 'LDO', 'PENGU', 'APT', 'WIF', 'DOT', 'ARB', 'CFX', 'HBAR',
  'MORPHO', 'DYDX', 'INJ', 'AVGO', 'OP', 'EIGEN', 'IBM', 'ATOM', 'MNT', 'BIO',
  'FIL', 'STRK', 'TIA', 'CHIP', 'STBL', 'MANTA', 'IP', 'IMX', 'NOK', 'STABLE',
  'ALGO', 'RUNE', 'POL', 'ICP', 'SKY', 'SYRUP', 'LINEA', 'ENS', 'HEMI', 'RENDER',
  'APEX', 'SEI', 'DASH', 'BERA', 'MET', 'AR', 'ASML', 'ETC', 'KAS', 'AZTEC',
  'PYTH', 'DELL', 'SMH', 'KAITO', 'POPCAT', 'NIL', 'NOW', 'APE', 'ZK', 'CAKE',
  'W', '2Z', 'IO', 'MELANIA', 'COMP', 'NXPC', 'REZ', 'ZORA', 'AVNT', 'S',
  'SNX', 'GRIFFAIN', 'LAYER', 'BSV', 'STX', 'BLUR', 'MEME', 'TRB', 'EWT', 'ORDI',
  'VINE', 'XAI', 'ZETA', 'MERL', 'MINA', 'AXS', 'MOODENG', 'FOGO', 'BRETT', 'SAND',
  'NEO', 'AIXBT', 'ZEN', 'GMX', 'MOVE', 'UMA', 'GALA', 'ALT', 'BABY', 'GOAT',
  'TURBO', 'NOT', 'PROVE', 'SAGA', 'DYM', 'INIT', 'GMT', '0G', 'SKR', 'PNUT',
  'BOME', 'IOTA', 'RESOLV', 'GBP', 'ACE', 'ME', 'SUSHI', 'GAS', 'HMSTR', 'USUAL',
  'WCT', 'SUPER', 'SOPH', 'HYPER', 'BIGTIME', 'ANIME', 'BANANA', 'RSR', 'YGG', 'ARK',
  'POLYX', 'CELO', 'DOOD', 'PEOPLE', 'TNSR', 'EBAY',
] as const

/**
 * Every market in Minara's catalog (247) — crypto first, then each non-crypto
 * asset class. The AI-suggestion Market field offers exactly these (gated by the
 * server allowlist), and the server `suggestionSymbols` default mirrors this set.
 * The non-crypto slices are re-used from `trading.constants` so the categoriser
 * and the catalog can never drift.
 */
export const MINARA_CATALOG_SYMBOLS: readonly string[] = [
  ...MINARA_CRYPTO_SYMBOLS,
  ...STOCKS_SYMBOLS,
  ...COMMODITIES_SYMBOLS,
  ...INDICES_SYMBOLS,
  ...FX_SYMBOLS,
  ...PRE_IPO_SYMBOLS,
]
