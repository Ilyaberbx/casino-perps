import type { Fill, TwapSliceFillsReader, WalletAddress } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { HyperliquidGateway } from '../gateway/hyperliquid-gateway.types'
import type { UserTwapSliceFillsByTimeResponse } from '../gateway/sdk-types'
import { parseStringifiedNumber } from '../hyperliquid.utils'
import { createPagedHistoryReader } from './paged-history-reader'
import { dedupeByIdentifier } from '@/modules/shared/utils/dedupe-by-identifier'

/**
 * One-shot/paged reader over the Hyperliquid `userTwapSliceFillsByTime` info
 * endpoint (ADR-0053). Backs the TWAP panel's Fill History sub-tab. Each HL row
 * is `{ fill, twapId }`; we project the inner `fill` into the shared `Fill`
 * shape (identical field mapping to `trade-history-reader.ts`) so the Fill
 * History panel reuses the trade-history columns. `userTwapSliceFillsByTime`
 * returns newest-first by time window, so we page the next-older window by an
 * `endTime` cursor — the `descending` paged-history-reader order, same seam as
 * the Trade History tab. Trade Value (`price × size`) is computed at render, not
 * stored (ADR-0023 rule).
 */
export function createHyperliquidTwapSliceFillsReader(
  gateway: HyperliquidGateway,
  getAddress: () => WalletAddress | null,
  logger: Logger,
): TwapSliceFillsReader {
  return createPagedHistoryReader<Fill, UserTwapSliceFillsByTimeResponse>({
    getAddress,
    logger,
    logModule: 'hyperliquid-twap-slice-fills-reader',
    order: 'descending',
    fetch: (address, window) => gateway.getUserTwapSliceFills(address, window),
    project: (response) => dedupeByIdentifier(projectTwapSliceFills(response)),
    getTime: (fill) => fill.timestamp,
    getKey: (fill) => fill.identifier,
  })
}

export function projectTwapSliceFills(
  response: UserTwapSliceFillsByTimeResponse,
): ReadonlyArray<Fill> {
  const out: Fill[] = []
  for (const record of response) {
    const fill = record.fill
    out.push({
      // The same `tid` can recur across different TWAPs; combine with `twapId`
      // so two slice fills never collide on a React key (dedupe key).
      identifier: `${record.twapId}-${fill.tid}`,
      orderIdentifier: String(fill.oid),
      symbol: fill.coin,
      side: fill.side === 'B' ? 'buy' : 'sell',
      price: parseStringifiedNumber(fill.px),
      size: parseStringifiedNumber(fill.sz),
      fee: parseStringifiedNumber(fill.fee),
      timestamp: fill.time,
      closedPnl: parseStringifiedNumber(fill.closedPnl),
      direction: fill.dir,
      crossed: fill.crossed,
      feeToken: fill.feeToken,
    })
  }
  return out
}
