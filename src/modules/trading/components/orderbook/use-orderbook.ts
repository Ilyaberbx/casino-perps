import { useCallback, useState } from 'react'
import type { OrderbookUpdate, OrderbookLevel } from '../../../shared/domain/domain.types'
import { useCapability } from '../../../shared/providers/venue-provider'
import { useAdapterStream } from '../../hooks/use-adapter-stream'
import type {
  ChangeTracker,
  LevelChangeSignal,
  LevelCumulative,
  MidDirection,
  OrderbookRow,
  OrderbookState,
  UseOrderbookParams,
  UseOrderbookReturn,
} from './orderbook.types'
import { DISPLAY_DEPTH } from './orderbook.constants'
import {
  bucketLevels,
  decimalsForTick,
  deriveMid,
  diffLevelSizes,
  resolveMidDirection,
  withCumulativeLevels,
} from './orderbook.utils'

const EMPTY_STATE: OrderbookState = {
  bids: [],
  asks: [],
  sequence: 0,
  timestamp: 0,
  isLoading: true,
}

// `sequence: -1` (never a real tick) so the first real snapshot always counts as
// a new tick and seeds the size map WITHOUT flashing — nothing to compare against.
const EMPTY_CHANGE_TRACKER: ChangeTracker = {
  sequence: -1,
  sizes: new Map<number, number>(),
  signals: new Map<number, LevelChangeSignal>(),
}

function applyDiff(
  current: OrderbookLevel[],
  updates: OrderbookLevel[],
  isDescending: boolean,
): OrderbookLevel[] {
  const priceMap = new Map<number, number>()
  for (const level of current) {
    priceMap.set(level.price, level.size)
  }
  for (const update of updates) {
    const isDeletion = update.size === 0
    if (isDeletion) {
      priceMap.delete(update.price)
      continue
    }
    priceMap.set(update.price, update.size)
  }
  const result = Array.from(priceMap.entries()).map(([price, size]) => ({ price, size }))
  result.sort((levelA, levelB) =>
    isDescending ? levelB.price - levelA.price : levelA.price - levelB.price,
  )
  return result.slice(0, DISPLAY_DEPTH)
}

function reduceOrderbook(previous: OrderbookState, update: OrderbookUpdate): OrderbookState {
  const isSnapshot = update.kind === 'snapshot'
  const nextBids = isSnapshot
    ? update.bids.slice(0, DISPLAY_DEPTH)
    : applyDiff(previous.bids, update.bids, true)
  const nextAsks = isSnapshot
    ? update.asks.slice(0, DISPLAY_DEPTH)
    : applyDiff(previous.asks, update.asks, false)
  return {
    bids: nextBids,
    asks: nextAsks,
    sequence: update.sequence,
    timestamp: update.timestamp,
    isLoading: false,
  }
}

function maxTotal(levels: ReadonlyArray<LevelCumulative>): number {
  const isEmpty = levels.length === 0
  if (isEmpty) return 1
  return levels[levels.length - 1].total
}

/**
 * Merge each cumulative row with its price-keyed flash signal so the row can
 * replay a subtle value-change tint (#291). A level with no recorded change gets
 * `changeSeq: 0` / `changeDir: null` — the row renders no flash overlay.
 */
function attachChangeSignals(
  rows: ReadonlyArray<LevelCumulative>,
  signals: ReadonlyMap<number, LevelChangeSignal>,
): OrderbookRow[] {
  return rows.map((row) => {
    const signal = signals.get(row.price)
    return { ...row, changeSeq: signal?.seq ?? 0, changeDir: signal?.dir ?? null }
  })
}

function formatSpreadPercent(bestBid: number, spread: number): string {
  const hasBid = bestBid > 0
  if (!hasBid) return '0.000'
  return ((spread / bestBid) * 100).toFixed(3)
}

export function useOrderbook(params: UseOrderbookParams): UseOrderbookReturn {
  const { symbol, tick, sizeAsset } = params
  const visibleDepth = params.visibleDepth ?? DISPLAY_DEPTH
  const marketDataCap = useCapability('marketData')

  const subscribe = useCallback(
    (onEvent: (update: OrderbookUpdate) => void) => {
      // Bug A: skip the subscribe before any gateway/SDK call when the symbol
      // hasn't been resolved yet (market cache not loaded, or spot display
      // symbol with un-derivable @N key). Forwarding `coin: ""` to HL would
      // cause it to close the shared WebSocketTransport — taking out every
      // other live stream. The smart hook stays in its `initial` loading
      // state via `useAdapterStream({ resetOnSubscribe: true })`.
      // Belt-and-braces: the reader has the same guard at the gateway seam.
      if (symbol === '') return () => {}
      return marketDataCap.subscribeOrderbook(symbol, onEvent, { tick })
    },
    [marketDataCap, symbol, tick],
  )

  const state = useAdapterStream<OrderbookUpdate, OrderbookState>({
    initial: EMPTY_STATE,
    subscribe,
    reducer: reduceOrderbook,
    resetOnSubscribe: true,
  })

  const bucketedBids = bucketLevels(state.bids, tick, 'bid', visibleDepth)
  const bucketedAsks = bucketLevels(state.asks, tick, 'ask', visibleDepth)
  const bidLevels = withCumulativeLevels(bucketedBids, sizeAsset)
  const askLevels = withCumulativeLevels(bucketedAsks, sizeAsset)
  const maxBidTotal = maxTotal(bidLevels)
  const maxAskTotal = maxTotal(askLevels)

  // Value-change flash (#291): detect per-price-level size deltas between ticks
  // and hand each row a `changeSeq`/`changeDir` the row replays as a subtle tint.
  // ADR-0043 removed the old per-cell key-remount flash (it remounted up to 66
  // value spans EVERY tick — the dominant FPS sink); #291 reintroduces the flash
  // per explicit product request but only as a single overlay per CHANGED row
  // (~5/tick), leaving the value text and the gliding depth bars untouched.
  //
  // Detection is a render-time tracker (React 19 idiom — the React Compiler
  // forbids setState in an effect), keyed on the stream `sequence` so signals
  // recompute exactly once per data tick. The first snapshot only seeds the size
  // map (no flash: nothing to diff against). Setting state during render bails to
  // a synchronous re-render whose committed output reads the fresh signals.
  const [changeTracker, setChangeTracker] = useState<ChangeTracker>(EMPTY_CHANGE_TRACKER)
  const isNewTick = !state.isLoading && state.sequence !== changeTracker.sequence
  if (isNewTick) {
    const combinedLevels = [...bucketedBids, ...bucketedAsks]
    const diffed = diffLevelSizes(changeTracker.sizes, changeTracker.signals, combinedLevels)
    setChangeTracker({ sequence: state.sequence, sizes: diffed.sizes, signals: diffed.signals })
  }

  const bidsWithTotals = attachChangeSignals(bidLevels, changeTracker.signals)
  const asksWithTotals = attachChangeSignals(askLevels, changeTracker.signals)

  const bestBid = bucketedBids[0]?.price ?? 0
  const bestAsk = bucketedAsks[0]?.price ?? 0
  const spread = bestAsk - bestBid
  const spreadPercent = formatSpreadPercent(bestBid, spread)
  const priceDecimals = decimalsForTick(tick)

  // Track the mid tick direction in render (React 19 idiom — the React Compiler
  // forbids setState in an effect). When the mid moves we stamp the new value +
  // direction; a flat/absent reading keeps the arrow neutral.
  const mid = deriveMid(bestBid, bestAsk)
  const [previousMid, setPreviousMid] = useState<number>(mid)
  const [midDirection, setMidDirection] = useState<MidDirection>('flat')

  const isMidChanged = mid !== previousMid
  if (isMidChanged) {
    setPreviousMid(mid)
    setMidDirection(resolveMidDirection(previousMid, mid))
  }

  return {
    bids: bucketedBids,
    asks: bucketedAsks,
    sequence: state.sequence,
    timestamp: state.timestamp,
    isLoading: state.isLoading,
    bidsWithTotals,
    asksWithTotals,
    maxBidTotal,
    maxAskTotal,
    spread,
    spreadPercent,
    mid,
    midDirection,
    priceDecimals,
  }
}
