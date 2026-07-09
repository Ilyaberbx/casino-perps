import type {
  Order,
  OpenOrdersSnapshotReader,
  Unsubscribe,
} from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { WebData2Response } from '../gateway/sdk-types'
import type { WebData2Stream } from './web-data2-stream'
import { parseStringifiedNumber } from '../hyperliquid.utils'
import { dedupeByIdentifier } from '@/modules/shared/utils/dedupe-by-identifier'

export function createHyperliquidOpenOrdersSnapshotReader(
  stream: WebData2Stream,
  logger: Logger,
): OpenOrdersSnapshotReader {
  const log = logger.child({ module: 'hyperliquid-open-orders-snapshot-reader' })
  log.debug({}, 'init')
  return {
    subscribe(onUpdate: (orders: ReadonlyArray<Order>) => void): Unsubscribe {
      return stream.subscribe((state) => {
        // HL keys each open order by `oid`, unique per tick today — dedupe keeps
        // React-key uniqueness a data-layer invariant if a future shape repeats one.
        const orders = dedupeByIdentifier(projectOpenOrders(state))
        log.debug({ count: orders.length }, 'projection')
        onUpdate(orders)
      })
    },
  }
}

function projectOpenOrders(state: WebData2Response): ReadonlyArray<Order> {
  const out: Order[] = []
  for (const raw of state.openOrders) {
    const price = parseStringifiedNumber(raw.limitPx)
    const size = parseStringifiedNumber(raw.sz)
    const origSize = parseStringifiedNumber(raw.origSz)
    const filledSize = Math.max(0, origSize - size)
    const triggerPx = parseStringifiedNumber(raw.triggerPx)
    const hasTriggerPrice = triggerPx > 0
    out.push({
      identifier: String(raw.oid),
      symbol: raw.coin,
      side: raw.side === 'B' ? 'buy' : 'sell',
      price,
      size: origSize,
      filledSize,
      status: 'open',
      orderType: raw.orderType === 'Market' ? 'market' : 'limit',
      timestamp: raw.timestamp,
      // ADR-0023 parity fields from the existing frontend-orders payload.
      originalSize: origSize,
      reduceOnly: raw.reduceOnly,
      triggerConditions: raw.isTrigger ? raw.triggerCondition : undefined,
      // ADR-0051: machine-readable trigger fields for position TP/SL read-back.
      triggerPrice: hasTriggerPrice ? triggerPx : undefined,
      isPositionTpsl: raw.isPositionTpsl,
      triggerKind: deriveTriggerKind(raw.orderType),
    })
  }
  return out
}

// ADR-0051 D-2: derive TP vs SL from the venue's `orderType` string. "Take
// Profit Market/Limit" ⇒ tp; "Stop Market/Limit" ⇒ sl; plain Market/Limit have
// no kind. Keeps Hyperliquid's order-type vocabulary at the reader boundary.
function deriveTriggerKind(orderType: string): 'tp' | 'sl' | undefined {
  if (orderType.startsWith('Take Profit')) return 'tp'
  if (orderType.startsWith('Stop')) return 'sl'
  return undefined
}
