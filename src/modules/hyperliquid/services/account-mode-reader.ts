import type { AccountMode, AccountModeReader } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { HyperliquidPullService } from './hyperliquid-pull'
import { isSegregatedAccount } from '../hyperliquid.utils'

/**
 * Projects the pull snapshot's `abstractionMode` into the venue-agnostic
 * `AccountMode` ({ isSegregated }). The Hyperliquid mode literals stay behind
 * this seam — consumers (Transfer gate, portfolio scope toggle, balance/
 * portfolio readers) see only the boolean. Re-emits on every pull tick, so a
 * mode change (rare) propagates within one poll. See ADR-0033.
 */
export function createHyperliquidAccountModeReader(
  pull: HyperliquidPullService,
  logger: Logger,
): AccountModeReader {
  const log = logger.child({ module: 'hyperliquid-account-mode-reader' })
  log.debug({}, 'init')
  const project = (): AccountMode => ({
    isSegregated: isSegregatedAccount(pull.current().abstractionMode),
  })
  return {
    current() {
      return project()
    },
    subscribe(onChange) {
      return pull.subscribe(() => {
        const mode = project()
        log.debug({ isSegregated: mode.isSegregated }, 'projection')
        onChange(mode)
      })
    },
  }
}
