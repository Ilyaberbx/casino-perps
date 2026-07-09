import type {
  ActiveTwap,
  TwapActiveSnapshotReader,
  Unsubscribe,
} from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { WebData2Response } from '../gateway/sdk-types'
import type { WebData2Stream } from './web-data2-stream'
import { parseStringifiedNumber } from '../hyperliquid.utils'
import { dedupeByIdentifier } from '@/modules/shared/utils/dedupe-by-identifier'

export function createHyperliquidTwapActiveSnapshotReader(
  stream: WebData2Stream,
  logger: Logger,
): TwapActiveSnapshotReader {
  const log = logger.child({ module: 'hyperliquid-twap-active-snapshot-reader' })
  log.debug({}, 'init')
  return {
    subscribe(onUpdate: (twaps: ReadonlyArray<ActiveTwap>) => void): Unsubscribe {
      return stream.subscribe((state) => {
        // `twapStates` is a Map so ids are unique today; dedupe keeps the
        // React-key invariant defensive and consistent with the other lists.
        const twaps = dedupeByIdentifier(projectActiveTwaps(state))
        log.debug({ count: twaps.length }, 'projection')
        onUpdate(twaps)
      })
    },
  }
}

function projectActiveTwaps(state: WebData2Response): ReadonlyArray<ActiveTwap> {
  const out: ActiveTwap[] = []
  for (const [id, twap] of state.twapStates) {
    out.push({
      identifier: String(id),
      symbol: twap.coin,
      side: twap.side === 'B' ? 'buy' : 'sell',
      size: parseStringifiedNumber(twap.sz),
      executedSize: parseStringifiedNumber(twap.executedSz),
      executedNotionalUsd: parseStringifiedNumber(twap.executedNtl),
      durationMinutes: twap.minutes,
      reduceOnly: twap.reduceOnly,
      randomize: twap.randomize,
      createdAt: twap.timestamp,
    })
  }
  return out
}
