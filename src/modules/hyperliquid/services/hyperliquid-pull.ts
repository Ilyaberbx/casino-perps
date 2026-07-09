import type { ResultAsync } from 'neverthrow'
import type {
  PortfolioWindow,
  PortfolioWindowValues,
  Unsubscribe,
  WalletAddress,
} from '@/modules/shared/domain'
import { uniformPortfolioWindowValues } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import { formatAddress } from '@/modules/shared/logger'
import type { HyperliquidGateway, HyperliquidGatewayError } from '../gateway'

type ResultLike<T> = ResultAsync<T, HyperliquidGatewayError>

type PullSource =
  | 'portfolio'
  | 'userFees'
  | 'delegatorSummary'
  | 'borrowLendUserState'
  | 'spotMetaAndAssetCtxs'
  | 'userAbstraction'
  | 'allPerpMetas'
import type {
  AllPerpMetasResponse,
  BorrowLendUserStateResponse,
  DelegatorSummaryResponse,
  PortfolioResponse,
  UserAbstractionResponse,
  UserFeesResponse,
} from '../gateway/sdk-types'
import {
  FOURTEEN_DAY_VOLUME_WINDOW,
  PORTFOLIO_POLL_MS,
  USDC_TOKEN_INDEX,
} from '../hyperliquid.constants'
import {
  buildSpotPriceIndex,
  buildSpotTokenSymbolByIndex,
  lastSeriesValue,
  parseStringifiedNumber,
  pickPortfolioBucket,
  type HyperliquidPortfolioPeriod,
  type SpotPriceIndex,
  type SpotTokenSymbolByIndex,
} from '../hyperliquid.utils'

/**
 * Window-keyed PnL + Volume for one Hyperliquid bucket family (combined or
 * perp*). Both come from the SAME `getPortfolio` response — the reader picks the
 * perp family for the `'perps'` scope (mirroring `mapToPeriod`). See ADR-0039.
 */
export interface HyperliquidPortfolioFamily {
  readonly pnl: PortfolioWindowValues
  readonly volume: PortfolioWindowValues
}

/**
 * Aggregate of HTTP-only data Hyperliquid does not expose over WebSocket.
 * Refreshed on a fixed cadence (`PORTFOLIO_POLL_MS`) per active wallet.
 */
export interface HyperliquidPullSnapshot {
  /**
   * Combined-account window-keyed PnL/Volume (day/week/month/allTime buckets).
   * The reader projects this into the snapshot for the `'all'` scope.
   */
  readonly portfolioCombined: HyperliquidPortfolioFamily
  /**
   * Perp-account window-keyed PnL/Volume (perpDay/perpWeek/perpMonth/perpAllTime
   * buckets). The reader projects this for the `'perps'` scope. See ADR-0039.
   */
  readonly portfolioPerps: HyperliquidPortfolioFamily
  readonly fourteenDayVolume: number
  readonly stakingHype: number
  readonly earnSupplyByToken: ReadonlyMap<string, number>
  readonly currentTier: { readonly key: string; readonly label: string } | null
  /**
   * The raw `getUserFees` payload, surfaced so the fee-schedule and
   * volume-history readers can project from the 30s pull instead of each
   * firing their own `getUserFees` on every `webData2` tick (the rate-limit
   * leak; see ADR-0022). `fourteenDayVolume` / `currentTier` are kept as cheap
   * derivations of the same payload for the other consumers that depend on them.
   */
  readonly userFees: UserFeesResponse | null
  readonly spotPrices: SpotPriceIndex
  readonly spotTokenSymbolByIndex: SpotTokenSymbolByIndex
  /**
   * The account's Hyperliquid abstraction mode (`disabled | default |
   * unifiedAccount | portfolioMargin | dexAbstraction`), or `null` before the
   * first read / on read failure. Single source for the venue-agnostic
   * `accountMode` capability and the unified-aware balance/portfolio readers
   * (ADR-0033). Near-static — read on the same 30s cadence as the other
   * HTTP-only sources.
   */
  readonly abstractionMode: UserAbstractionResponse | null
  /**
   * Spot-token indices that serve as **unified-margin collateral** — the union
   * of every perp dex's `collateralToken` from `allPerpMetas` (the default dex
   * is USDC = 0; HIP-3 builder dexes add stablecoins like USDH/USDE/USDT0). On
   * a unified account, a spot balance whose token is in this set is collateral
   * for some perp dex and shows the `unified` source; everything else is plain
   * `spot`. Resolved to symbols against `spotTokenSymbolByIndex` at read time so
   * both come from the same snapshot (no cross-source ordering race). See ADR-0033.
   */
  readonly unifiedCollateralTokenIndices: ReadonlySet<number>
}

export interface HyperliquidPullService {
  current(): HyperliquidPullSnapshot
  subscribe(onUpdate: (snapshot: HyperliquidPullSnapshot) => void): Unsubscribe
  refreshAddress(): void
  stop(): void
}

export interface CreateHyperliquidPullOptions {
  readonly gateway: HyperliquidGateway
  readonly getAddress: () => WalletAddress | null
  readonly logger: Logger
  readonly intervalMs?: number
  readonly setTimer?: (handler: () => void, ms: number) => unknown
  readonly clearTimer?: (handle: unknown) => void
}

const EMPTY_PORTFOLIO_FAMILY: HyperliquidPortfolioFamily = {
  pnl: uniformPortfolioWindowValues(0),
  volume: uniformPortfolioWindowValues(0),
}

const EMPTY_SNAPSHOT: HyperliquidPullSnapshot = {
  portfolioCombined: EMPTY_PORTFOLIO_FAMILY,
  portfolioPerps: EMPTY_PORTFOLIO_FAMILY,
  fourteenDayVolume: 0,
  stakingHype: 0,
  earnSupplyByToken: new Map(),
  currentTier: null,
  userFees: null,
  spotPrices: new Map([['USDC', 1]]),
  spotTokenSymbolByIndex: new Map(),
  abstractionMode: null,
  unifiedCollateralTokenIndices: new Set([USDC_TOKEN_INDEX]),
}

/**
 * Single HTTP poller that fans out to multiple subscribers. Owns the timer.
 *
 * On each tick (and immediately on first subscribe / address change):
 * - `getPortfolio(addr)` — drives window-keyed pnl + volume for both bucket
 *   families (combined: day/week/month/allTime; perp: perp* variants). ADR-0039.
 * - `getUserFees(addr)`  — drives 14-day volume + current fee tier.
 * - `getDelegatorSummary(addr)` — drives Staking Account bucket.
 * - `getBorrowLendUserState(addr)` — drives Earn Balance bucket.
 * - `getSpotMetaAndAssetCtxs()` — drives spot price index for non-USDC balances.
 * - `getAllPerpMetas()` — drives the unified-margin collateral-token set.
 *
 * On error: keep last known values and log a structured `warn` per source.
 * There is no UI surface for HTTP failures yet (out of scope per the plan).
 */
export function createHyperliquidPullService(
  options: CreateHyperliquidPullOptions,
): HyperliquidPullService {
  const intervalMs = options.intervalMs ?? PORTFOLIO_POLL_MS
  const schedule = options.setTimer ?? ((h, ms) => setInterval(h, ms))
  const cancel = options.clearTimer ?? ((handle) => clearInterval(handle as ReturnType<typeof setInterval>))
  const log = options.logger.child({ module: 'hyperliquid-pull' })
  log.debug({}, 'init')

  let snapshot: HyperliquidPullSnapshot = EMPTY_SNAPSHOT
  const listeners = new Set<(s: HyperliquidPullSnapshot) => void>()
  let timerHandle: unknown = null
  let activeAddress: WalletAddress | null = null
  let stopped = false

  function emit(): void {
    for (const listener of listeners) listener(snapshot)
  }

  function update(patch: Partial<HyperliquidPullSnapshot>): void {
    snapshot = { ...snapshot, ...patch }
    emit()
  }

  function tick(address: WalletAddress): void {
    log.debug({ address: formatAddress(address) }, 'tick')
    const handle = <T,>(source: PullSource, p: ResultLike<T>, onOk: (value: T) => void): void => {
      const startedAt = Date.now()
      void p.then((res) => {
        if (stopped || activeAddress !== address) return
        if (res.isErr()) {
          log.warn(
            { source, kind: res.error.kind, errorMessage: res.error.message },
            'pull failed',
          )
          return
        }
        log.debug({ source, durationMs: Date.now() - startedAt }, 'pull ok')
        onOk(res.value)
      })
    }
    handle('portfolio', options.gateway.getPortfolio(address), (v) => update(projectPortfolio(v)))
    handle('userFees', options.gateway.getUserFees(address), (v) => update(projectFees(v)))
    handle('delegatorSummary', options.gateway.getDelegatorSummary(address), (v) =>
      update({ stakingHype: projectStakingHype(v) }),
    )
    handle('borrowLendUserState', options.gateway.getBorrowLendUserState(address), (v) =>
      update({ earnSupplyByToken: projectEarnSupply(v) }),
    )
    handle('spotMetaAndAssetCtxs', options.gateway.getSpotMetaAndAssetCtxs(), (v) =>
      update({
        spotPrices: buildSpotPriceIndex(v),
        spotTokenSymbolByIndex: buildSpotTokenSymbolByIndex(v[0]),
      }),
    )
    handle('userAbstraction', options.gateway.queryUserAbstraction(address), (v) =>
      update({ abstractionMode: v }),
    )
    handle('allPerpMetas', options.gateway.getAllPerpMetas(), (v) =>
      update({ unifiedCollateralTokenIndices: projectCollateralTokenIndices(v) }),
    )
  }

  function ensurePolling(): void {
    if (stopped) return
    const address = options.getAddress()
    const isAddressMissing = address === null
    if (isAddressMissing) {
      if (activeAddress !== null) {
        log.info({ from: formatAddress(activeAddress) }, 'stop')
      }
      activeAddress = null
      if (timerHandle !== null) {
        cancel(timerHandle)
        timerHandle = null
      }
      snapshot = EMPTY_SNAPSHOT
      emit()
      return
    }
    const isSameAddress = activeAddress === address
    if (isSameAddress) return
    const previousAddress = activeAddress
    if (timerHandle !== null) cancel(timerHandle)
    activeAddress = address
    if (previousAddress === null) {
      log.info({ address: formatAddress(address) }, 'start')
    } else {
      log.info(
        { from: formatAddress(previousAddress), to: formatAddress(address) },
        'address change',
      )
    }
    snapshot = EMPTY_SNAPSHOT
    emit()
    tick(address)
    timerHandle = schedule(() => {
      if (stopped || activeAddress === null) return
      tick(activeAddress)
    }, intervalMs)
  }

  return {
    current() {
      return snapshot
    },
    subscribe(onUpdate) {
      listeners.add(onUpdate)
      ensurePolling()
      onUpdate(snapshot)
      return () => {
        listeners.delete(onUpdate)
      }
    },
    refreshAddress() {
      // Revival: see the matching note in web-data2-stream.ts. A refreshAddress
      // call after stop() means the consumer wants polling again — clear the
      // permanent-stop flag before ensurePolling, otherwise it bails forever
      // and the four HTTP-only sources (portfolio/fees/staking/borrow/spotMeta)
      // never recover from the StrictMode dispose-cleanup pass.
      if (stopped) {
        log.info({}, 'refresh after stop — reviving')
        stopped = false
      }
      ensurePolling()
    },
    stop() {
      stopped = true
      log.info({ address: formatAddress(activeAddress) }, 'stop')
      if (timerHandle !== null) {
        cancel(timerHandle)
        timerHandle = null
      }
      activeAddress = null
      snapshot = EMPTY_SNAPSHOT
    },
  }
}

// The bucket key for each (family, window) pair. The combined family maps to the
// plain period buckets; the perp family to the perp* buckets — the same mapping
// `mapToPeriod` applies, kept here so the snapshot caches both families from the
// single response. See ADR-0039.
const COMBINED_PERIOD_BY_WINDOW: Readonly<Record<PortfolioWindow, HyperliquidPortfolioPeriod>> = {
  '24H': 'day',
  '7D': 'week',
  '30D': 'month',
  AllTime: 'allTime',
}
const PERP_PERIOD_BY_WINDOW: Readonly<Record<PortfolioWindow, HyperliquidPortfolioPeriod>> = {
  '24H': 'perpDay',
  '7D': 'perpWeek',
  '30D': 'perpMonth',
  AllTime: 'perpAllTime',
}

const PORTFOLIO_WINDOWS: ReadonlyArray<PortfolioWindow> = ['24H', '7D', '30D', 'AllTime']

function projectPortfolio(
  response: PortfolioResponse,
): Pick<HyperliquidPullSnapshot, 'portfolioCombined' | 'portfolioPerps'> {
  return {
    portfolioCombined: projectPortfolioFamily(response, COMBINED_PERIOD_BY_WINDOW),
    portfolioPerps: projectPortfolioFamily(response, PERP_PERIOD_BY_WINDOW),
  }
}

function projectPortfolioFamily(
  response: PortfolioResponse,
  periodByWindow: Readonly<Record<PortfolioWindow, HyperliquidPortfolioPeriod>>,
): HyperliquidPortfolioFamily {
  const pnl: Record<PortfolioWindow, number> = { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 }
  const volume: Record<PortfolioWindow, number> = { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 }
  for (const window of PORTFOLIO_WINDOWS) {
    const bucket = pickPortfolioBucket(response, periodByWindow[window])
    if (bucket === null) continue
    pnl[window] = lastSeriesValue(bucket.pnlHistory)
    volume[window] = parseStringifiedNumber(bucket.vlm)
  }
  return { pnl, volume }
}

function projectFees(
  response: UserFeesResponse,
): Pick<HyperliquidPullSnapshot, 'fourteenDayVolume' | 'currentTier' | 'userFees'> {
  const recent = response.dailyUserVlm.slice(-FOURTEEN_DAY_VOLUME_WINDOW)
  let total = 0
  for (const entry of recent) {
    total += parseStringifiedNumber(entry.userCross) + parseStringifiedNumber(entry.userAdd)
  }
  return {
    fourteenDayVolume: total,
    currentTier: resolveCurrentTier(response),
    userFees: response,
  }
}

function resolveCurrentTier(
  response: UserFeesResponse,
): { key: string; label: string } | null {
  const userCross = parseStringifiedNumber(response.userCrossRate)
  const tiers = response.feeSchedule.tiers.vip
  for (let i = 0; i < tiers.length; i += 1) {
    const tier = tiers[i]
    if (tier === undefined) continue
    if (parseStringifiedNumber(tier.cross) === userCross) {
      const key = `vip-${i + 1}`
      return { key, label: `VIP ${i + 1}` }
    }
  }
  return { key: 'standard', label: 'Standard' }
}

/**
 * Collect every perp dex's `collateralToken` (spot-token index) into a set. The
 * default dex is USDC (0); HIP-3 builder dexes contribute their own collateral
 * stablecoins (e.g. USDH=360, USDE=235, USDT0=268). USDC is always included so
 * the set is never empty even if the response is.
 */
function projectCollateralTokenIndices(
  response: AllPerpMetasResponse,
): ReadonlySet<number> {
  const indices = new Set<number>([USDC_TOKEN_INDEX])
  for (const meta of response) {
    indices.add(meta.collateralToken)
  }
  return indices
}

function projectStakingHype(response: DelegatorSummaryResponse): number {
  return (
    parseStringifiedNumber(response.delegated) +
    parseStringifiedNumber(response.undelegated) +
    parseStringifiedNumber(response.totalPendingWithdrawal)
  )
}

function projectEarnSupply(
  response: BorrowLendUserStateResponse,
): ReadonlyMap<string, number> {
  // tokenToState entries are [tokenId, state]; the supply.value is denominated in
  // the underlying token. Callers convert to USD via the spot price index, since
  // tokenId → symbol is supplied separately by spotMeta.
  const out = new Map<string, number>()
  for (const entry of response.tokenToState) {
    const [tokenId, state] = entry
    const value = parseStringifiedNumber(state.supply.value)
    if (value === 0) continue
    out.set(String(tokenId), value)
  }
  return out
}
