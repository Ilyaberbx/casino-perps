import type {
  Fill,
  TradeHistoryReader,
  WalletAddress,
} from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { HyperliquidGateway } from '../gateway/hyperliquid-gateway.types'
import type { UserFillsByTimeResponse } from '../gateway/sdk-types'
import { parseStringifiedNumber } from '../hyperliquid.utils'
import { createPagedHistoryReader } from './paged-history-reader'
import { dedupeByIdentifier } from '@/modules/shared/utils/dedupe-by-identifier'

export function createHyperliquidTradeHistoryReader(
  gateway: HyperliquidGateway,
  getAddress: () => WalletAddress | null,
  logger: Logger,
): TradeHistoryReader {
  return createPagedHistoryReader<Fill, UserFillsByTimeResponse>({
    getAddress,
    logger,
    logModule: 'hyperliquid-trade-history-reader',
    // userFillsByTime honours `reversed: true` (set in the gateway), so fills
    // arrive newest-first. We page the next-older window by an `endTime` cursor,
    // keeping deep fill history reachable while showing recent trades on top
    // (ADR-0034). Heavy traders with >cap lifetime fills still see recent fills,
    // not the oldest, which the old oldest-first window scan got wrong.
    order: 'descending',
    fetch: (address, window) => gateway.getUserFillsByTime(address, window),
    // HL emits both sides of a self-trade match under one tid; dedupe per page
    // before accumulating. The reader also dedupes by `getKey` across the
    // page-boundary overlap so no fill renders twice as a React key.
    project: (response) => dedupeByIdentifier(projectFills(response)),
    getTime: (fill) => fill.timestamp,
    getKey: (fill) => fill.identifier,
  })
}

export function projectFills(
  response: UserFillsByTimeResponse,
): ReadonlyArray<Fill> {
  const out: Fill[] = []
  for (const fill of response) {
    out.push({
      identifier: String(fill.tid),
      orderIdentifier: String(fill.oid),
      symbol: fill.coin,
      side: fill.side === 'B' ? 'buy' : 'sell',
      price: parseStringifiedNumber(fill.px),
      size: parseStringifiedNumber(fill.sz),
      fee: parseStringifiedNumber(fill.fee),
      timestamp: fill.time,
      // ADR-0023: parity columns sourced from the existing fills payload —
      // no extra gateway call. `dir` is HL's human label ('Open Long', …);
      // `crossed` is the taker flag (true ⇒ Taker, false ⇒ Maker); `feeToken`
      // names the token the fee is denominated in (e.g. 'USDC').
      closedPnl: parseStringifiedNumber(fill.closedPnl),
      direction: fill.dir,
      crossed: fill.crossed,
      feeToken: fill.feeToken,
    })
  }
  return out
}
