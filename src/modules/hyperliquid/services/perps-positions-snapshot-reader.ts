import type {
  PerpPositionSnapshot,
  PerpsPositionsSnapshotReader,
  Unsubscribe,
} from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { AllDexsClearinghouseStateEvent } from '../gateway/sdk-types'
import type { AllDexsClearinghouseStateStream } from './all-dexs-clearinghouse-state-stream'
import { parseStringifiedNumber } from '../hyperliquid.utils'

export function createHyperliquidPerpsPositionsSnapshotReader(
  stream: AllDexsClearinghouseStateStream,
  logger: Logger,
): PerpsPositionsSnapshotReader {
  const log = logger.child({ module: 'hyperliquid-perps-positions-reader' })
  log.debug({}, 'init')
  return {
    subscribe(
      onUpdate: (positions: ReadonlyArray<PerpPositionSnapshot>) => void,
    ): Unsubscribe {
      return stream.subscribe((event) => {
        const positions = projectPositions(event)
        log.debug({ count: positions.length }, 'projection')
        onUpdate(positions)
      })
    },
  }
}

/**
 * Projects EVERY dex's clearinghouse state into the venue-agnostic snapshot.
 * `event.clearinghouseStates` carries the main perp dex (`dex === ''`) PLUS
 * every HIP-3 dex, so iterating it surfaces HIP-3 positions (e.g. `xyz:NVDA`)
 * that the old single-dex `webData2` projection could never see. The `coin`
 * field is already namespaced for HIP-3 (`xyz:NVDA`) and bare for the main dex
 * (`BTC`); it is kept RAW here — formatting/badges are a different slice.
 *
 * The `allDexsClearinghouseState` position carries no `markPx`, so the mark
 * price is derived as `positionValueUsd / size` (size = |szi|, > 0 since
 * szi === 0 positions are skipped).
 */
function projectPositions(
  event: AllDexsClearinghouseStateEvent,
): ReadonlyArray<PerpPositionSnapshot> {
  const out: PerpPositionSnapshot[] = []
  for (const [, state] of event.clearinghouseStates) {
    for (const ap of state.assetPositions) {
      const szi = parseStringifiedNumber(ap.position.szi)
      if (szi === 0) continue
      const size = Math.abs(szi)
      const positionValueUsd = parseStringifiedNumber(ap.position.positionValue)
      const unrealizedPnlUsd = parseStringifiedNumber(ap.position.unrealizedPnl)
      const roeRatio = parseStringifiedNumber(ap.position.returnOnEquity)
      out.push({
        symbol: ap.position.coin,
        side: szi > 0 ? 'long' : 'short',
        size,
        entryPrice: parseStringifiedNumber(ap.position.entryPx),
        markPrice: positionValueUsd / size,
        positionValueUsd,
        unrealizedPnlUsd,
        roePct: roeRatio * 100,
        leverage: ap.position.leverage.value,
        leverageType: ap.position.leverage.type,
        liquidationPrice:
          ap.position.liquidationPx === null
            ? null
            : parseStringifiedNumber(ap.position.liquidationPx),
        marginUsedUsd: parseStringifiedNumber(ap.position.marginUsed),
      })
    }
  }
  return out
}
