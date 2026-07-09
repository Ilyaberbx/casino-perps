import type {
  Balance,
  BalanceSource,
  BalancesReader,
  PortfolioAccountScope,
  Unsubscribe,
} from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { WebData2Response } from '../gateway/sdk-types'
import type { WebData2Stream } from './web-data2-stream'
import type { HyperliquidPullService } from './hyperliquid-pull'
import {
  canonicalizeUnitToken,
  isSegregatedAccount,
  parseStringifiedNumber,
  resolveUnifiedCollateralSymbols,
  type SpotPriceIndex,
} from '../hyperliquid.utils'
import { USDC_SYMBOL } from '../hyperliquid.constants'

export function createHyperliquidBalancesReader(
  stream: WebData2Stream,
  pull: HyperliquidPullService,
  logger: Logger,
): BalancesReader {
  const log = logger.child({ module: 'hyperliquid-balances-reader' })
  log.debug({}, 'init')
  return {
    subscribe(scope: PortfolioAccountScope, onUpdate: (balances: ReadonlyArray<Balance>) => void): Unsubscribe {
      const emit = (): void => {
        const state = stream.current()
        if (state === null) return
        const snapshot = pull.current()
        const isSegregated = isSegregatedAccount(snapshot.abstractionMode)
        const collateralSymbols = resolveUnifiedCollateralSymbols(
          snapshot.unifiedCollateralTokenIndices,
          snapshot.spotTokenSymbolByIndex,
        )
        const balances = isSegregated
          ? projectBalances(state, scope, snapshot.spotPrices)
          : projectUnifiedBalances(state, scope, snapshot.spotPrices, collateralSymbols)
        log.debug({ scope, isSegregated, count: balances.length }, 'projection')
        onUpdate(balances)
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

function projectBalances(
  state: WebData2Response,
  scope: PortfolioAccountScope,
  spotPrices: SpotPriceIndex,
): ReadonlyArray<Balance> {
  const isPerpsOnly = scope === 'perps'
  if (isPerpsOnly) return projectPerpsBalances(state)
  return projectSpotBalances(state, spotPrices, () => 'spot')
}

/**
 * Unified / portfolio-margin accounts: ALL balances and holds live in the spot
 * clearinghouse state; the perp margin summary is not meaningful (reports ~0
 * even when funded). So there is a single unified view — the `perps` scope holds
 * no separate margin pool (returns `[]`, no phantom ~0 row). `available = total
 * − hold` is unchanged: holds already live in spot for these accounts.
 *
 * Source is per-row: unified margin pools collateral *per collateral-token*, so
 * only assets that are some perp dex's collateral (USDC + HIP-3 dex stablecoins
 * like USDH/USDE/USDT0) are `unified`. A non-collateral spot holding (BTC, ETH,
 * …) is plain `spot` even on a unified account — it is not perp margin. See
 * ADR-0033 and `hyperliquid-account-modes.md`.
 */
function projectUnifiedBalances(
  state: WebData2Response,
  scope: PortfolioAccountScope,
  spotPrices: SpotPriceIndex,
  collateralSymbols: ReadonlySet<string>,
): ReadonlyArray<Balance> {
  const isPerpsOnly = scope === 'perps'
  if (isPerpsOnly) return []
  const sourceFor = (rawCoin: string): BalanceSource =>
    collateralSymbols.has(rawCoin) ? 'unified' : 'spot'
  return projectSpotBalances(state, spotPrices, sourceFor)
}

function projectPerpsBalances(state: WebData2Response): ReadonlyArray<Balance> {
  const margin = state.clearinghouseState.marginSummary
  // Total Balance is the perps account *equity* (`accountValue`, which already
  // includes unrealized PnL) — matching Hyperliquid's own Balances tab. The old
  // `totalRawUsd` excludes unrealized PnL and understated the row whenever an
  // open position was in profit/loss. Available Balance is the SDK-reported
  // `withdrawable` (margin- and PnL-aware), not a hand-derived
  // `totalRawUsd - totalMarginUsed` approximation.
  const accountValue = parseStringifiedNumber(margin.accountValue)
  const withdrawable = parseStringifiedNumber(state.clearinghouseState.withdrawable)
  const unrealized = sumUnrealizedPnl(state)
  const isAccountFlat = accountValue === 0
  const pnlPct = isAccountFlat ? null : (unrealized / accountValue) * 100
  return [
    {
      asset: USDC_SYMBOL,
      amount: accountValue,
      available: withdrawable,
      amountUsd: accountValue,
      pnlPct,
      source: 'perps',
    },
  ]
}

function projectSpotBalances(
  state: WebData2Response,
  spotPrices: SpotPriceIndex,
  sourceFor: (rawCoin: string) => BalanceSource,
): ReadonlyArray<Balance> {
  // Combine `balances` + `evmEscrows` (evmEscrows lack `hold`, so available
  // collapses to total). Zero-total spot rows are kept visible — the panel's
  // "Hide Small Balances" toggle filters them out below the USD threshold
  // when the user wants them gone.
  const balances = state.spotState?.balances ?? []
  const escrows = state.spotState?.evmEscrows ?? []
  const escrowByCoin = new Map<string, number>()
  for (const e of escrows) {
    const t = parseStringifiedNumber(e.total)
    if (t === 0) continue
    escrowByCoin.set(e.coin, (escrowByCoin.get(e.coin) ?? 0) + t)
  }

  const out: Balance[] = []
  const seenCoins = new Set<string>()
  for (const bal of balances) {
    seenCoins.add(bal.coin)
    const isUsdc = bal.coin === USDC_SYMBOL
    const priceUsd = isUsdc ? 1 : (spotPrices.get(bal.coin) ?? 0)
    const total = parseStringifiedNumber(bal.total) + (escrowByCoin.get(bal.coin) ?? 0)
    const hold = parseStringifiedNumber(bal.hold)
    out.push({
      // Canonicalize the display symbol (UBTC → BTC) at this boundary; the raw
      // `bal.coin` above stays the spot-price join key (ADR-0018).
      asset: canonicalizeUnitToken(bal.coin),
      amount: total,
      available: total - hold,
      amountUsd: total * priceUsd,
      pnlPct: null,
      source: sourceFor(bal.coin),
    })
  }
  // Escrow-only coins (no row in `balances`).
  for (const [coin, escrowTotal] of escrowByCoin) {
    if (seenCoins.has(coin)) continue
    const isUsdc = coin === USDC_SYMBOL
    const priceUsd = isUsdc ? 1 : (spotPrices.get(coin) ?? 0)
    out.push({
      asset: canonicalizeUnitToken(coin),
      amount: escrowTotal,
      available: escrowTotal,
      amountUsd: escrowTotal * priceUsd,
      pnlPct: null,
      source: sourceFor(coin),
    })
  }
  return out
}

function sumUnrealizedPnl(state: WebData2Response): number {
  let total = 0
  for (const ap of state.clearinghouseState.assetPositions) {
    total += parseStringifiedNumber(ap.position.unrealizedPnl)
  }
  return total
}
