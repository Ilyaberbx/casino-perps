import type { Trade, OrderbookLevel, Side, WalletAddress } from '../shared/domain'

const NEUTRAL_DRIFT = 0.5
const MAX_BOOK_LEVELS_FOR_TRADES = 2
const LOGNORMAL_SIGMA = 0.5

/**
 * Fixed pool of synthetic participant addresses. Trades draw their taker and
 * maker from this pool so the same handful of wallets recur across rows — this
 * is what makes the spectate/Taker-Maker feature demoable on the mock venue
 * without a live connection. Already-lowercase 40-hex literals, branded once.
 */
const SYNTHETIC_ADDRESS_POOL: readonly WalletAddress[] = [
  '0x1111111111111111111111111111111111111111',
  '0x2222222222222222222222222222222222222222',
  '0x3333333333333333333333333333333333333333',
  '0x4444444444444444444444444444444444444444',
  '0x5555555555555555555555555555555555555555',
  '0x6666666666666666666666666666666666666666',
  '0x7777777777777777777777777777777777777777',
  '0x8888888888888888888888888888888888888888',
] as unknown as readonly WalletAddress[]

/**
 * Pick a taker and a distinct maker from the synthetic pool using the seeded
 * RNG, so the assignment is deterministic per trade and repeats across rows.
 */
function selectParticipants(random: () => number): { taker: WalletAddress; maker: WalletAddress } {
  const poolSize = SYNTHETIC_ADDRESS_POOL.length
  const takerIndex = Math.floor(random() * poolSize)
  const makerOffset = 1 + Math.floor(random() * (poolSize - 1))
  const makerIndex = (takerIndex + makerOffset) % poolSize
  return {
    taker: SYNTHETIC_ADDRESS_POOL[takerIndex],
    maker: SYNTHETIC_ADDRESS_POOL[makerIndex],
  }
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let z = state
    z = Math.imul(z ^ (z >>> 15), z | 1)
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000
  }
}

function combineSeed(seed: number, time: number, extra: number): number {
  return ((seed * 1000003) ^ (time | 0) ^ (extra * 31337)) >>> 0
}

function sampleLognormal(random: () => number, baseSize: number): number {
  const uniformA = Math.max(random(), 1e-12)
  const uniformB = random()
  const normalSample = Math.sqrt(-2 * Math.log(uniformA)) * Math.cos(2 * Math.PI * uniformB)
  return baseSize * Math.exp(LOGNORMAL_SIGMA * normalSample)
}

function determineSide(random: () => number, drift: number): Side {
  const buyProbability = NEUTRAL_DRIFT + drift * NEUTRAL_DRIFT
  const clampedProbability = Math.min(1, Math.max(0, buyProbability))
  const isBuy = random() < clampedProbability
  return isBuy ? 'buy' : 'sell'
}

function selectPrice(
  side: Side,
  bids: OrderbookLevel[],
  asks: OrderbookLevel[],
  random: () => number,
): number {
  const levelCount = MAX_BOOK_LEVELS_FOR_TRADES
  const isBuySide = side === 'buy'
  const levels = isBuySide ? asks : bids
  const availableLevels = levels.slice(0, levelCount)
  const isBookEmpty = availableLevels.length === 0
  if (isBookEmpty) {
    return isBuySide ? asks[0]?.price ?? 0 : bids[0]?.price ?? 0
  }
  const levelIndex = Math.floor(random() * availableLevels.length)
  return availableLevels[levelIndex].price
}

function buildTradeIdentifier(symbol: string, seed: number, time: number, index: number): string {
  const combined = combineSeed(seed, time, index)
  return `trade-${symbol}-${combined.toString(16)}`
}

export function generateTrade(
  symbol: string,
  bids: OrderbookLevel[],
  asks: OrderbookLevel[],
  seed: number,
  timestamp: number,
  drift: number = 0,
): Trade {
  const combined = combineSeed(seed, timestamp, 0)
  const random = mulberry32(combined)

  const side = determineSide(random, drift)
  const price = selectPrice(side, bids, asks, random)

  const baseSize = bids[0]?.size ?? asks[0]?.size ?? 1
  const size = sampleLognormal(random, baseSize)
  const identifier = buildTradeIdentifier(symbol, seed, timestamp, 0)
  const { taker, maker } = selectParticipants(random)

  return {
    identifier,
    symbol,
    side,
    price,
    size,
    timestamp,
    takerAddress: taker,
    makerAddress: maker,
  }
}

export function generateTrades(
  symbol: string,
  bids: OrderbookLevel[],
  asks: OrderbookLevel[],
  seed: number,
  timestamp: number,
  count: number,
  drift: number = 0,
): Trade[] {
  const trades: Trade[] = []
  for (let index = 0; index < count; index++) {
    const tradeSeed = combineSeed(seed, timestamp, index + 1)
    const trade = generateTrade(symbol, bids, asks, tradeSeed, timestamp + index, drift)
    trades.push(trade)
  }
  return trades
}
