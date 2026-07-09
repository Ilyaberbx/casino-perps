import type {
  PortfolioSnapshot,
  PortfolioWindowValues,
  Unsubscribe,
  PortfolioPoint,
  PortfolioMetric,
  PortfolioWindow,
  PortfolioAccountScope,
} from '../../shared/domain'

const BASELINE_ACCOUNT_VALUE = 10_000
const ACCOUNT_DRIFT_PER_TICK = 0.005
const PNL_DRIFT_PER_TICK = 0.01
const PERPS_PNL_DRIFT_PER_TICK = 0.01
const VOLUME_PER_TICK_BASELINE = 25
const VOLUME_PER_TICK_RANGE = 75
const SPOT_EQUITY_BASELINE = 4_000
const PERPS_EQUITY_BASELINE = 6_000
const FOURTEEN_DAY_VOLUME_BASELINE = 120_000
const FOURTEEN_DAY_VOLUME_RANGE = 80_000
const PERPS_SCOPE_FACTOR = 0.6
const DEFAULT_TICK_INTERVAL_MILLISECONDS = 1_000

interface SubscribeOptions {
  seed?: number
  tickIntervalMilliseconds?: number
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

function symmetricNoise(random: () => number): number {
  return random() * 2 - 1
}

interface ProcessState {
  accountValue: number
  pnl: number
  perpsPnl: number
  volume: number
  spotEquity: number
  perpsEquity: number
  fourteenDayVolume: number
}

function nextState(state: ProcessState, random: () => number): ProcessState {
  const accountStep = symmetricNoise(random) * ACCOUNT_DRIFT_PER_TICK
  const pnlStep = symmetricNoise(random) * PNL_DRIFT_PER_TICK
  const perpsStep = symmetricNoise(random) * PERPS_PNL_DRIFT_PER_TICK
  const volumeStep = VOLUME_PER_TICK_BASELINE + random() * VOLUME_PER_TICK_RANGE
  const spotStep = symmetricNoise(random) * ACCOUNT_DRIFT_PER_TICK
  const perpsEquityStep = symmetricNoise(random) * ACCOUNT_DRIFT_PER_TICK

  return {
    accountValue: state.accountValue * (1 + accountStep),
    pnl: state.pnl + state.accountValue * pnlStep,
    perpsPnl: state.perpsPnl + state.accountValue * perpsStep,
    volume: state.volume + volumeStep,
    spotEquity: state.spotEquity * (1 + spotStep),
    perpsEquity: state.perpsEquity * (1 + perpsEquityStep),
    fourteenDayVolume: state.fourteenDayVolume + volumeStep,
  }
}

function scopeFactor(scope: PortfolioAccountScope): number {
  return scope === 'perps' ? PERPS_SCOPE_FACTOR : 1
}

// Per-window multipliers applied to the base (24H) accumulator so each period
// renders a visibly distinct PnL/Volume in dev — the wider the window, the more
// cumulative activity. Deterministic; lets the period selector be exercised
// without a live venue. See ADR-0039.
const WINDOW_MULTIPLIER: Record<PortfolioWindow, number> = {
  '24H': 1,
  '7D': 3.2,
  '30D': 7.5,
  AllTime: 14.8,
}

function windowValues(base: number): PortfolioWindowValues {
  return {
    '24H': base * WINDOW_MULTIPLIER['24H'],
    '7D': base * WINDOW_MULTIPLIER['7D'],
    '30D': base * WINDOW_MULTIPLIER['30D'],
    AllTime: base * WINDOW_MULTIPLIER.AllTime,
  }
}

function snapshotFromState(
  state: ProcessState,
  scope: PortfolioAccountScope,
  timestamp: number,
): PortfolioSnapshot {
  const factor = scopeFactor(scope)
  return {
    accountValue: state.accountValue * factor,
    pnl: windowValues(state.pnl * factor),
    perpsPnl: state.perpsPnl,
    volume: windowValues(state.volume * factor),
    spotEquity: scope === 'perps' ? 0 : state.spotEquity,
    perpsEquity: state.perpsEquity,
    fourteenDayVolume: state.fourteenDayVolume * factor,
    timestamp,
  }
}

export function subscribePortfolioSnapshot(
  scope: PortfolioAccountScope,
  onUpdate: (snapshot: PortfolioSnapshot) => void,
  options: SubscribeOptions = {},
): Unsubscribe {
  const seed = options.seed ?? 42
  const tickIntervalMilliseconds =
    options.tickIntervalMilliseconds ?? DEFAULT_TICK_INTERVAL_MILLISECONDS
  const random = mulberry32(seed)

  let state: ProcessState = {
    accountValue: BASELINE_ACCOUNT_VALUE,
    pnl: 0,
    perpsPnl: 0,
    volume: 0,
    spotEquity: SPOT_EQUITY_BASELINE,
    perpsEquity: PERPS_EQUITY_BASELINE,
    fourteenDayVolume: FOURTEEN_DAY_VOLUME_BASELINE + random() * FOURTEEN_DAY_VOLUME_RANGE,
  }

  onUpdate(snapshotFromState(state, scope, Date.now()))

  const timer = setInterval(() => {
    state = nextState(state, random)
    onUpdate(snapshotFromState(state, scope, Date.now()))
  }, tickIntervalMilliseconds)

  return () => {
    clearInterval(timer)
  }
}

const HISTORY_WINDOW_BUCKETS: Record<
  PortfolioWindow,
  { bucketIntervalMilliseconds: number; bucketCount: number }
> = {
  '24H': { bucketIntervalMilliseconds: 5 * 60 * 1000, bucketCount: 288 },
  '7D': { bucketIntervalMilliseconds: 60 * 60 * 1000, bucketCount: 168 },
  '30D': { bucketIntervalMilliseconds: 6 * 60 * 60 * 1000, bucketCount: 120 },
  AllTime: { bucketIntervalMilliseconds: 24 * 60 * 60 * 1000, bucketCount: 365 },
}

interface HistoryOptions {
  seed?: number
  endTimestamp?: number
}

function metricSeedSalt(metric: PortfolioMetric): number {
  if (metric === 'accountValue') return 0x9e3779b1
  if (metric === 'pnl') return 0x85ebca77
  if (metric === 'perpsPnl') return 0xc2b2ae3d
  return 0x27d4eb2f
}

function scopeSeedSalt(scope: PortfolioAccountScope): number {
  return scope === 'perps' ? 0x13371337 : 0
}

function nextHistoryValue(
  metric: PortfolioMetric,
  previous: number,
  random: () => number,
): number {
  if (metric === 'accountValue') {
    const step = symmetricNoise(random) * ACCOUNT_DRIFT_PER_TICK
    return previous * (1 + step)
  }
  if (metric === 'pnl') {
    const step = symmetricNoise(random) * PNL_DRIFT_PER_TICK
    return previous + BASELINE_ACCOUNT_VALUE * step
  }
  if (metric === 'perpsPnl') {
    const step = symmetricNoise(random) * PERPS_PNL_DRIFT_PER_TICK
    return previous + BASELINE_ACCOUNT_VALUE * step
  }
  const volumeStep = VOLUME_PER_TICK_BASELINE + random() * VOLUME_PER_TICK_RANGE
  return previous + volumeStep
}

function startingValueFor(metric: PortfolioMetric, scope: PortfolioAccountScope): number {
  const factor = scopeFactor(scope)
  if (metric === 'accountValue') return BASELINE_ACCOUNT_VALUE * factor
  return 0
}

export function generatePortfolioHistory(
  metric: PortfolioMetric,
  window: PortfolioWindow,
  scope: PortfolioAccountScope,
  options: HistoryOptions = {},
): PortfolioPoint[] {
  const seed = options.seed ?? 42
  const endTimestamp = options.endTimestamp ?? Date.now()
  const { bucketIntervalMilliseconds, bucketCount } = HISTORY_WINDOW_BUCKETS[window]
  const random = mulberry32((seed ^ metricSeedSalt(metric) ^ scopeSeedSalt(scope)) >>> 0)

  const alignedEnd =
    Math.floor(endTimestamp / bucketIntervalMilliseconds) * bucketIntervalMilliseconds
  const firstTimestamp = alignedEnd - (bucketCount - 1) * bucketIntervalMilliseconds

  const points: PortfolioPoint[] = []
  let value = startingValueFor(metric, scope)
  for (let index = 0; index < bucketCount; index++) {
    value = nextHistoryValue(metric, value, random)
    points.push({
      timestamp: firstTimestamp + index * bucketIntervalMilliseconds,
      value,
    })
  }
  return points
}
