import type {
  VolumeHistory,
  VolumeHistoryEntry,
  VolumeHistoryReader,
  Unsubscribe,
} from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { UserFeesResponse } from '../gateway/sdk-types'
import type { HyperliquidPullService } from './hyperliquid-pull'
import { parseStringifiedNumber } from '../hyperliquid.utils'

/**
 * Projects daily volume history from the shared 30s pull snapshot's `userFees`
 * payload — no per-tick `getUserFees` of its own (ADR-0022). Shares the pull's
 * single `getUserFees` source with the fee-schedule reader.
 */
export function createHyperliquidVolumeHistoryReader(
  pull: HyperliquidPullService,
  logger: Logger,
): VolumeHistoryReader {
  const log = logger.child({ module: 'hyperliquid-volume-history-reader' })
  log.debug({}, 'init')
  const listeners = new Set<(history: VolumeHistory) => void>()
  let latest: VolumeHistory | null = null

  function notify(): void {
    const payload = pull.current().userFees
    if (payload === null) return
    const history = projectVolumeHistory(payload)
    latest = history
    log.debug({ entryCount: history.entries.length }, 'projection')
    for (const listener of listeners) listener(history)
  }

  pull.subscribe(() => notify())

  return {
    subscribe(onUpdate): Unsubscribe {
      listeners.add(onUpdate)
      if (latest !== null) onUpdate(latest)
      return () => {
        listeners.delete(onUpdate)
      }
    },
  }
}

export function projectVolumeHistory(payload: UserFeesResponse): VolumeHistory {
  const entries: VolumeHistoryEntry[] = payload.dailyUserVlm.map((row) => ({
    date: row.date,
    exchangeVolume: parseStringifiedNumber(row.exchange),
    userMakerVolume: parseStringifiedNumber(row.userAdd),
    userTakerVolume: parseStringifiedNumber(row.userCross),
  }))
  return { entries }
}
