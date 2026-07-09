import type {
  EquityExtensionBucket,
  EquityExtensionsReader,
  PortfolioAccountScope,
  Unsubscribe,
} from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { WebData2Response } from '../gateway/sdk-types'
import type { WebData2Stream } from './web-data2-stream'
import type { HyperliquidPullService, HyperliquidPullSnapshot } from './hyperliquid-pull'
import {
  getPerpMarkPriceUsd,
  parseStringifiedNumber,
  type SpotPriceIndex,
  type SpotTokenSymbolByIndex,
} from '../hyperliquid.utils'
import { HYPE_SYMBOL, USDC_SYMBOL } from '../hyperliquid.constants'

export function createHyperliquidEquityExtensionsReader(
  stream: WebData2Stream,
  pull: HyperliquidPullService,
  logger: Logger,
): EquityExtensionsReader {
  const log = logger.child({ module: 'hyperliquid-equity-reader' })
  log.debug({}, 'init')
  return {
    subscribe(
      scope: PortfolioAccountScope,
      onUpdate: (buckets: ReadonlyArray<EquityExtensionBucket>) => void,
    ): Unsubscribe {
      const emit = (): void => {
        const state = stream.current()
        if (state === null) return
        const buckets = projectBuckets(state, scope, pull.current())
        log.debug({ scope, count: buckets.length }, 'projection')
        onUpdate(buckets)
      }
      const unsubStream = stream.subscribe(emit)
      const unsubPull = pull.subscribe(emit)
      return () => {
        unsubStream()
        unsubPull()
      }
    },
  }
}

function projectBuckets(
  state: WebData2Response,
  scope: PortfolioAccountScope,
  pullSnap: HyperliquidPullSnapshot,
): ReadonlyArray<EquityExtensionBucket> {
  const isPerpsOnly = scope === 'perps'
  if (isPerpsOnly) return []
  const hypeMarkPx = getPerpMarkPriceUsd(state, HYPE_SYMBOL)
  const stakingUsd = pullSnap.stakingHype * hypeMarkPx
  const earnUsd = computeEarnUsd(pullSnap.earnSupplyByToken, pullSnap.spotTokenSymbolByIndex, pullSnap.spotPrices)
  return [
    {
      key: 'vault',
      label: 'Vault Equity',
      amountUsd: parseStringifiedNumber(state.totalVaultEquity),
      hint: 'incl. uPNL',
    },
    { key: 'earn', label: 'Earn Balance', amountUsd: earnUsd },
    { key: 'staking', label: 'Staking Account', amountUsd: stakingUsd },
  ]
}

function computeEarnUsd(
  earnSupplyByToken: ReadonlyMap<string, number>,
  symbolByIndex: SpotTokenSymbolByIndex,
  spotPrices: SpotPriceIndex,
): number {
  let total = 0
  for (const [tokenIdStr, supply] of earnSupplyByToken) {
    const tokenId = Number(tokenIdStr)
    const symbol = symbolByIndex.get(tokenId)
    if (symbol === undefined) continue
    const isUsdc = symbol === USDC_SYMBOL
    const priceUsd = isUsdc ? 1 : (spotPrices.get(symbol) ?? 0)
    total += supply * priceUsd
  }
  return total
}
