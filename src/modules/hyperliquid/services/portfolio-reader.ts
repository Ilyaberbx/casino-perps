import { errAsync, okAsync } from 'neverthrow'
import {
  PortfolioHistoryError,
  type MarginSummarySnapshot,
  type PortfolioReader,
  type PortfolioSnapshot,
  type PortfolioAccountScope,
  type PortfolioMetric,
  type PortfolioWindow,
  type Unsubscribe,
  type WalletAddress,
} from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import { formatAddress } from '@/modules/shared/logger'
import type { HyperliquidGateway } from '../gateway/hyperliquid-gateway.types'
import type { AllDexsClearinghouseStateEvent, WebData2Response } from '../gateway/sdk-types'
import type { WebData2Stream } from './web-data2-stream'
import type { AllDexsClearinghouseStateStream } from './all-dexs-clearinghouse-state-stream'
import type { HyperliquidPullService, HyperliquidPullSnapshot } from './hyperliquid-pull'
import {
  isSegregatedAccount,
  mapToPeriod,
  parseStringifiedNumber,
  pickPortfolioBucket,
  resolveUnifiedCollateralSymbols,
  type SpotPriceIndex,
} from '../hyperliquid.utils'
import { USDC_SYMBOL } from '../hyperliquid.constants'

export function createHyperliquidPortfolioReader(
  stream: WebData2Stream,
  allDexsStream: AllDexsClearinghouseStateStream,
  pull: HyperliquidPullService,
  gateway: HyperliquidGateway,
  getAddress: () => WalletAddress | null,
  logger: Logger,
): PortfolioReader {
  const log = logger.child({ module: 'hyperliquid-portfolio-reader' })
  log.debug({}, 'init')
  return {
    subscribeSnapshot(scope, onUpdate) {
      const wrapped = (snap: PortfolioSnapshot): void => {
        log.debug(
          {
            address: formatAddress(getAddress()),
            scope,
            accountValue: snap.accountValue,
          },
          'projection',
        )
        onUpdate(snap)
      }
      // Re-emit on either the webData2 stream (spot/vault) or the all-dexs
      // clearinghouse stream (perp equity + uPnL across main + HIP-3 dexes) or
      // the pull snapshot (mode, prices) — any of the three changing the figure.
      const emit = (): void => emitCurrent(scope, wrapped, stream, allDexsStream, pull)
      const unsubStream = stream.subscribe(emit)
      const unsubAllDexs = allDexsStream.subscribe(emit)
      const unsubPull = pull.subscribe(emit)
      return composeUnsubscribers(unsubStream, unsubAllDexs, unsubPull)
    },
    getHistory(metric: PortfolioMetric, window: PortfolioWindow, scope: PortfolioAccountScope) {
      const address = getAddress()
      if (address === null) {
        return errAsync(
          new PortfolioHistoryError('wallet-not-connected', 'No wallet address available'),
        )
      }
      const period = mapToPeriod(metric, window, scope)
      if (period === null) {
        return errAsync(
          new PortfolioHistoryError(
            'unsupported-metric',
            `Metric '${metric}' is not supported by the Hyperliquid portfolio endpoint`,
          ),
        )
      }
      return gateway.getPortfolio(address).andThen((response) => {
        const bucket = pickPortfolioBucket(response, period)
        if (bucket === null) {
          return errAsync(
            new PortfolioHistoryError(
              'unsupported-metric',
              `Period '${period}' missing from Hyperliquid portfolio response`,
            ),
          )
        }
        const isAccountValue = metric === 'accountValue'
        const seriesRaw = isAccountValue ? bucket.accountValueHistory : bucket.pnlHistory
        return okAsync(
          seriesRaw.map(([timestamp, valueStr]) => ({
            timestamp,
            value: parseStringifiedNumber(valueStr),
          })),
        )
      }).mapErr((gatewayError) =>
        new PortfolioHistoryError(
          'wallet-not-connected',
          `Gateway error fetching portfolio: ${gatewayError.message}`,
        ),
      )
    },
  }
}

function emitCurrent(
  scope: PortfolioAccountScope,
  onUpdate: (snapshot: PortfolioSnapshot) => void,
  stream: WebData2Stream,
  allDexsStream: AllDexsClearinghouseStateStream,
  pull: HyperliquidPullService,
): void {
  const state = stream.current()
  if (state === null) return
  onUpdate(projectSnapshot(state, allDexsStream.current(), scope, pull.current()))
}

function composeUnsubscribers(...unsubs: ReadonlyArray<Unsubscribe>): Unsubscribe {
  return () => {
    for (const u of unsubs) u()
  }
}

function projectSnapshot(
  state: WebData2Response,
  allDexs: AllDexsClearinghouseStateEvent | null,
  scope: PortfolioAccountScope,
  pullSnap: HyperliquidPullSnapshot,
): PortfolioSnapshot {
  const isSegregated = isSegregatedAccount(pullSnap.abstractionMode)
  const totalVaultEquity = parseStringifiedNumber(state.totalVaultEquity)
  const spotEquity = computeSpotEquity(state, pullSnap.spotPrices)
  // Collateral-eligible spot equity for the unified 'perps' (buying-power) scope:
  // volatile non-collateral holdings (HYPE, BTC, …) are NOT perp margin, so they
  // are excluded — the deterministic mirror of HL's `tokenToAvailableAfterMaintenance`
  // (bug #1). Full `spotEquity` still drives net worth ('all') and the spotEquity
  // split; only the unified 'perps' read narrows to collateral.
  const collateralSymbols = resolveUnifiedCollateralSymbols(
    pullSnap.unifiedCollateralTokenIndices,
    pullSnap.spotTokenSymbolByIndex,
  )
  const collateralSpotEquity = computeSpotEquity(state, pullSnap.spotPrices, collateralSymbols)
  // Perp equity + uPnL are summed across EVERY dex (main `''` + every HIP-3 dex)
  // from the all-dexs clearinghouse stream — the single-dex `webData2.clearinghouseState`
  // misses builder-deployed perps entirely (the analogue of the positions reader,
  // which migrated off webData2 for the same reason). Per-dex `marginSummary.accountValue`
  // is real even for unified accounts (where the AGGREGATE main-dex summary is the
  // phantom-0 of hyperliquid-account-modes.md §0). See §3 (amended).
  const perpEquityAllDexes = sumPerpEquityAllDexes(allDexs, state)
  const perpsPnl = sumUnrealizedPnlAllDexes(allDexs, state)
  // 'all' = net worth (every dex's perp equity + spot + vault). 'perps' stays the
  // perp-tradeable collateral for order-entry buying power: main-dex perp equity
  // (segregated) / collateral spot (unified) — NOT the all-dexs sum, since HIP-3
  // isolated equity is not main-dex order margin (account-modes §3, untouched).
  const equity = isSegregated
    ? projectSegregatedEquity(state, scope, spotEquity, totalVaultEquity, perpEquityAllDexes)
    : projectUnifiedEquity(scope, spotEquity, collateralSpotEquity, totalVaultEquity, perpEquityAllDexes)
  // Window-keyed PnL/Volume come pre-computed for both bucket families on the
  // pull snapshot; pick the perp* family for the 'perps' scope, mirroring
  // `mapToPeriod`'s usePerps rule. The summary card then selects by window. ADR-0039.
  const isPerpsScope = scope === 'perps'
  const portfolioFamily = isPerpsScope ? pullSnap.portfolioPerps : pullSnap.portfolioCombined
  return {
    accountValue: equity.accountValue,
    pnl: portfolioFamily.pnl,
    perpsPnl,
    volume: portfolioFamily.volume,
    spotEquity: equity.spotEquity,
    perpsEquity: equity.perpsEquity,
    fourteenDayVolume: pullSnap.fourteenDayVolume,
    timestamp: state.serverTime,
  }
}

function projectSegregatedEquity(
  state: WebData2Response,
  scope: PortfolioAccountScope,
  spotEquity: number,
  totalVaultEquity: number,
  perpEquityAllDexes: number,
): { accountValue: number; spotEquity: number; perpsEquity: number } {
  // 'perps' (buying-power) scope = MAIN-dex perp equity only; HIP-3 isolated
  // equity is not main-dex order margin (account-modes §3). 'all' = net worth,
  // summing every dex's perp equity. perpsEquity (the display split) carries the
  // all-dexs total so the summary's Perps row reflects builder-deployed perps too.
  const mainDexPerpsEquity = parseStringifiedNumber(state.clearinghouseState.marginSummary.accountValue)
  const isPerpsOnly = scope === 'perps'
  const accountValue = isPerpsOnly
    ? mainDexPerpsEquity
    : perpEquityAllDexes + spotEquity + totalVaultEquity
  return { accountValue, spotEquity, perpsEquity: perpEquityAllDexes }
}

function projectUnifiedEquity(
  scope: PortfolioAccountScope,
  spotEquity: number,
  collateralSpotEquity: number,
  totalVaultEquity: number,
  perpEquityAllDexes: number,
): { accountValue: number; spotEquity: number; perpsEquity: number } {
  // 'perps' scope narrows to the perp-tradeable collateral: collateral-eligible
  // spot only (volatile holdings excluded — bug #1), and vault equity excluded
  // (not order margin), mirroring the segregated 'perps' narrow — UNCHANGED.
  // 'all' = net worth: spot (hold-netted available, per webData2) + every dex's
  // perp equity + vault. perpsEquity now carries the REAL all-dexs perp equity
  // (HIP-3 dexes); it is no longer collapsed to 0 — the phantom-0 was the
  // AGGREGATE main-dex marginSummary, not the per-dex figures. ADR-0033 D-4 (amended).
  const isPerpsOnly = scope === 'perps'
  const accountValue = isPerpsOnly
    ? collateralSpotEquity
    : perpEquityAllDexes + spotEquity + totalVaultEquity
  return { accountValue, spotEquity, perpsEquity: perpEquityAllDexes }
}

/**
 * Sum the perp account equity over every dex (main `''` + every HIP-3 dex) from
 * the all-dexs clearinghouse event. Each per-dex `marginSummary.accountValue` is
 * the real equity for that dex (incl. its position margin + uPnL) — meaningful
 * even for unified accounts, where only the AGGREGATE main-dex summary is phantom.
 * Falls back to the single main-dex webData2 figure until the all-dexs frame lands.
 */
function sumPerpEquityAllDexes(
  event: AllDexsClearinghouseStateEvent | null,
  fallback: WebData2Response,
): number {
  if (event === null) {
    return parseStringifiedNumber(fallback.clearinghouseState.marginSummary.accountValue)
  }
  let total = 0
  for (const [, dexState] of event.clearinghouseStates) {
    total += parseStringifiedNumber(dexState.marginSummary.accountValue)
  }
  return total
}

/** Sum unrealized PnL over every dex's open positions; webData2 main-dex fallback. */
function sumUnrealizedPnlAllDexes(
  event: AllDexsClearinghouseStateEvent | null,
  fallback: WebData2Response,
): number {
  if (event === null) return sumUnrealizedPnl(fallback)
  let total = 0
  for (const [, dexState] of event.clearinghouseStates) {
    for (const ap of dexState.assetPositions) {
      total += parseStringifiedNumber(ap.position.unrealizedPnl)
    }
  }
  return total
}

function sumUnrealizedPnl(state: WebData2Response): number {
  let total = 0
  for (const ap of state.clearinghouseState.assetPositions) {
    total += parseStringifiedNumber(ap.position.unrealizedPnl)
  }
  return total
}

/**
 * Project the derived cross-margin facts for the equity card (ADR-0072). Lives
 * here — alongside `projectSnapshot` — because the raw `crossMarginSummary` /
 * `crossMaintenanceMarginUsed` literals are sanctioned only in this file's
 * segregated branch (hyperliquid-account-modes.md §1). Unified / portfolio-margin
 * accounts have no meaningful cross maintenance margin, so Maintenance Margin /
 * Account Leverage stay null (the reference shows `--`) and `marginRatioPct` is
 * `0` to match the reference's green `0.00%` badge. Unrealized PnL, however, IS
 * shown for unified — sourced from the all-dexs positions (the open HIP-3 position
 * the single-dex webData2 summary never sees). `accountLeverage` = (a)/(b);
 * `marginRatioPct` = maintenance / (b).
 */
export function projectMarginSummary(
  state: WebData2Response,
  pullSnap: HyperliquidPullSnapshot,
  allDexs: AllDexsClearinghouseStateEvent | null,
): MarginSummarySnapshot {
  const isSegregated = isSegregatedAccount(pullSnap.abstractionMode)
  if (!isSegregated) {
    return {
      maintenanceMarginUsd: null,
      accountLeverage: null,
      marginRatioPct: 0,
      unrealizedPnlUsd: sumUnrealizedPnlAllDexes(allDexs, state),
      totalCrossPositionsValueUsd: null,
      crossAccountValueUsd: null,
    }
  }
  const maintenanceMarginUsd = parseStringifiedNumber(state.clearinghouseState.crossMaintenanceMarginUsed)
  const crossAccountValueUsd = parseStringifiedNumber(state.clearinghouseState.crossMarginSummary.accountValue)
  const totalCrossPositionsValueUsd = parseStringifiedNumber(state.clearinghouseState.crossMarginSummary.totalNtlPos)
  const unrealizedPnlUsd = sumUnrealizedPnlAllDexes(allDexs, state)
  const hasEquity = crossAccountValueUsd > 0
  const accountLeverage = hasEquity ? totalCrossPositionsValueUsd / crossAccountValueUsd : null
  const marginRatioPct = hasEquity ? (maintenanceMarginUsd / crossAccountValueUsd) * 100 : 0
  return {
    maintenanceMarginUsd,
    accountLeverage,
    marginRatioPct,
    unrealizedPnlUsd,
    totalCrossPositionsValueUsd,
    crossAccountValueUsd,
  }
}

function computeSpotEquity(
  state: WebData2Response,
  spotPrices: SpotPriceIndex,
  eligibleSymbols?: ReadonlySet<string>,
): number {
  // Spot equity = balances + evmEscrows priced via the pull-cache spot price
  // index. Hyperliquid's reference UI also includes EVM escrows in this total.
  // When `eligibleSymbols` is supplied, only those coins count — the unified
  // 'perps' buying-power read passes the collateral-eligible set (bug #1).
  let total = 0
  const balances = state.spotState?.balances ?? []
  for (const bal of balances) {
    const isCollateralEligible = eligibleSymbols === undefined || eligibleSymbols.has(bal.coin)
    if (!isCollateralEligible) continue
    const isUsdc = bal.coin === USDC_SYMBOL
    const priceUsd = isUsdc ? 1 : (spotPrices.get(bal.coin) ?? 0)
    total += parseStringifiedNumber(bal.total) * priceUsd
  }
  const escrows = state.spotState?.evmEscrows ?? []
  for (const e of escrows) {
    const isCollateralEligible = eligibleSymbols === undefined || eligibleSymbols.has(e.coin)
    if (!isCollateralEligible) continue
    const isUsdc = e.coin === USDC_SYMBOL
    const priceUsd = isUsdc ? 1 : (spotPrices.get(e.coin) ?? 0)
    total += parseStringifiedNumber(e.total) * priceUsd
  }
  return total
}
