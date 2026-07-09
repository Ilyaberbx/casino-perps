import { ok, err, okAsync, type Result, type ResultAsync } from 'neverthrow'
import type {
  Candle,
  CandleUpdate,
  Interval,
  LoadOlderResult,
  Unsubscribe,
} from '../shared/domain'
import { CandleError } from '../shared/domain'
import { computePrice } from './price-process'
import { ANCHOR_PRICES } from './mock-venue.constants'
import type {
  CandleSubscriberStatus,
  SubscribeCandlesOptions,
} from './mock-venue.types'

const DEFAULT_HISTORY_COUNT = 500
const DEFAULT_SEED = 42
const DEFAULT_TICK_INTERVAL_MILLISECONDS = 1000
const INTRA_BAR_SAMPLES = 8
const VOLUME_BASE_MULTIPLIER = 50
const VOLUME_NOISE_AMPLITUDE = 0.6

const INTERVAL_MILLISECONDS: Record<Interval, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
  '1w': 604_800_000,
  '1M': 2_592_000_000,
}

export function intervalMilliseconds(interval: Interval): number {
  return INTERVAL_MILLISECONDS[interval]
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

function symbolHash(symbol: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < symbol.length; index++) {
    hash ^= symbol.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function intervalHash(interval: Interval): number {
  return symbolHash(interval)
}

function alignToInterval(time: number, intervalMs: number): number {
  return Math.floor(time / intervalMs) * intervalMs
}

function volumeSeed(symbol: string, interval: Interval, openTime: number, seed: number): number {
  const symbolPart = symbolHash(symbol)
  const intervalPart = intervalHash(interval)
  const timePart = Math.imul((openTime / 1000) | 0, 0x9e3779b9)
  const seedPart = Math.imul(seed | 0, 0x6d2b79f5)
  return (symbolPart ^ intervalPart ^ timePart ^ seedPart) >>> 0
}

function computeVolume(symbol: string, interval: Interval, openTime: number, seed: number): number {
  const random = mulberry32(volumeSeed(symbol, interval, openTime, seed))
  const anchor = ANCHOR_PRICES[symbol] ?? 1000
  const intervalRatio = INTERVAL_MILLISECONDS[interval] / INTERVAL_MILLISECONDS['1m']
  const baseVolume = (VOLUME_BASE_MULTIPLIER * intervalRatio * 1000) / anchor
  const noise = 1 + (random() - 0.5) * 2 * VOLUME_NOISE_AMPLITUDE
  return Math.max(0.001, baseVolume * noise)
}

function buildCandle(
  symbol: string,
  interval: Interval,
  openTime: number,
  seed: number,
  endTime: number,
): Candle {
  const intervalMs = INTERVAL_MILLISECONDS[interval]
  const closeTime = openTime + intervalMs
  const sampleCap = Math.min(closeTime, endTime)
  const sampleSpan = Math.max(1, sampleCap - openTime)
  const sampleStep = sampleSpan / INTRA_BAR_SAMPLES

  const open = computePrice(symbol, seed, openTime)
  let high = open
  let low = open
  let close = open
  for (let index = 1; index <= INTRA_BAR_SAMPLES; index++) {
    const sampleTime = openTime + Math.floor(sampleStep * index)
    const price = computePrice(symbol, seed, sampleTime)
    if (price > high) high = price
    if (price < low) low = price
    close = price
  }
  const volume = computeVolume(symbol, interval, openTime, seed)
  return { symbol, interval, openTime, open, high, low, close, volume }
}

export function getHistory(
  symbol: string,
  interval: Interval,
  count: number = DEFAULT_HISTORY_COUNT,
  seed: number = DEFAULT_SEED,
  now: number = Date.now(),
): Result<Candle[], CandleError> {
  const isSymbolEmpty = symbol.length === 0
  if (isSymbolEmpty) {
    return err(new CandleError('invalid-symbol', 'symbol must be non-empty'))
  }
  const isCountInvalid = !Number.isFinite(count) || count <= 0
  if (isCountInvalid) {
    return err(new CandleError('invalid-count', 'count must be > 0'))
  }
  const intervalMs = INTERVAL_MILLISECONDS[interval]
  const isIntervalInvalid = intervalMs === undefined
  if (isIntervalInvalid) {
    return err(new CandleError('invalid-interval', `unknown interval ${interval}`))
  }

  const lastOpenTime = alignToInterval(now, intervalMs)
  const candles: Candle[] = []
  for (let index = count - 1; index >= 0; index--) {
    const openTime = lastOpenTime - index * intervalMs
    const isLastBar = index === 0
    const endTime = isLastBar ? now : openTime + intervalMs
    candles.push(buildCandle(symbol, interval, openTime, seed, endTime))
  }
  return ok(candles)
}

export function loadOlder(
  symbol: string,
  interval: Interval,
  beforeOpenTime: number,
  count: number,
  seed: number = DEFAULT_SEED,
): ResultAsync<LoadOlderResult, CandleError> {
  const intervalMs = INTERVAL_MILLISECONDS[interval]
  const isIntervalInvalid = intervalMs === undefined
  if (isIntervalInvalid) {
    return okAsync({ candles: [], reachedStart: true })
  }
  const requested = Math.max(1, count)
  const newestOpenTime = alignToInterval(beforeOpenTime - intervalMs, intervalMs)
  const candles: Candle[] = []
  for (let index = requested - 1; index >= 0; index--) {
    const openTime = newestOpenTime - index * intervalMs
    const endTime = openTime + intervalMs
    candles.push(buildCandle(symbol, interval, openTime, seed, endTime))
  }
  return okAsync({ candles, reachedStart: false })
}

export function subscribe(
  symbol: string,
  interval: Interval,
  onUpdate: (update: CandleUpdate) => void,
  options: SubscribeCandlesOptions = {},
): Unsubscribe {
  const seed = options.seed ?? DEFAULT_SEED
  const tickIntervalMs = options.tickIntervalMilliseconds ?? DEFAULT_TICK_INTERVAL_MILLISECONDS
  const intervalMs = INTERVAL_MILLISECONDS[interval]

  let status: CandleSubscriberStatus = 'active'
  let currentOpenTime = alignToInterval(Date.now(), intervalMs)

  function emitOpenBar(kind: 'new' | 'update'): void {
    const isClosed = status === 'closed'
    if (isClosed) return
    const now = Date.now()
    const candle = buildCandle(symbol, interval, currentOpenTime, seed, now)
    onUpdate(kind === 'new' ? { kind: 'new', candle } : { kind: 'update', candle })
  }

  emitOpenBar('update')

  const timer = setInterval(() => {
    const isClosed = status === 'closed'
    if (isClosed) return
    const now = Date.now()
    const alignedOpenTime = alignToInterval(now, intervalMs)
    const isBoundaryCrossed = alignedOpenTime > currentOpenTime
    if (isBoundaryCrossed) {
      currentOpenTime = alignedOpenTime
      emitOpenBar('new')
      return
    }
    emitOpenBar('update')
  }, tickIntervalMs)

  return () => {
    status = 'closed'
    clearInterval(timer)
  }
}
