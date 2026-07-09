import type { MarginSummaryReader } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { HyperliquidPullService } from './hyperliquid-pull'
import type { WebData2Stream } from './web-data2-stream'
import type { AllDexsClearinghouseStateStream } from './all-dexs-clearinghouse-state-stream'
import { projectMarginSummary } from './portfolio-reader'

/**
 * Derived perp margin facts (Maintenance Margin / Account Leverage / Margin Ratio
 * / Unrealized PnL) for the equity card (ADR-0072). Mirrors the equity-extensions
 * reader: fans the webData2 stream + all-dexs clearinghouse stream + pull snapshot
 * into a single projected `MarginSummarySnapshot`. The all-dexs stream supplies
 * Unrealized PnL across main + HIP-3 dexes (the single-dex webData2 summary misses
 * builder-deployed positions). The raw-field reads live in `projectMarginSummary`
 * (portfolio-reader.ts) per hyperliquid-account-modes.md §1 — this reader only
 * orchestrates the subscription.
 */
export function createHyperliquidMarginSummaryReader(
  stream: WebData2Stream,
  allDexsStream: AllDexsClearinghouseStateStream,
  pull: HyperliquidPullService,
  logger: Logger,
): MarginSummaryReader {
  const log = logger.child({ module: 'hyperliquid-margin-summary-reader' })
  log.debug({}, 'init')
  return {
    subscribe(onUpdate) {
      const emit = (): void => {
        const state = stream.current()
        if (state === null) return
        const snapshot = projectMarginSummary(state, pull.current(), allDexsStream.current())
        log.debug({ marginRatioPct: snapshot.marginRatioPct }, 'projection')
        onUpdate(snapshot)
      }
      const unsubStream = stream.subscribe(emit)
      const unsubAllDexs = allDexsStream.subscribe(emit)
      const unsubPull = pull.subscribe(emit)
      return () => {
        unsubStream()
        unsubAllDexs()
        unsubPull()
      }
    },
  }
}
