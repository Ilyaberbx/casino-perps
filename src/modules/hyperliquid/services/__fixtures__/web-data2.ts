import { errAsync, okAsync } from 'neverthrow'
import type { Unsubscribe, WalletAddress } from '@/modules/shared/domain'
import type { LogFields, LogLevel, Logger } from '@/modules/shared/logger'
import type { HyperliquidGateway } from '../../gateway/hyperliquid-gateway.types'
import { HyperliquidGatewayError } from '../../gateway/hyperliquid-gateway.types'
import type {
  AllPerpMetasResponse,
  BorrowLendUserStateResponse,
  DelegatorSummaryResponse,
  PerpDexsResponse,
  PortfolioResponse,
  SpotMetaAndAssetCtxsResponse,
  SpotMetaResponse,
  UserFeesResponse,
  WebData2Response,
} from '../../gateway/sdk-types'
import type { HyperliquidPullService, HyperliquidPullSnapshot } from '../hyperliquid-pull'

/**
 * Build a synthetic-but-shape-correct WebData2Response for tests.
 * Fields default to safe zero values; override via `partial`.
 *
 * Numeric values are stringified to match the SDK's wire shape.
 */
export function buildWebData2(partial: Partial<{
  user: `0x${string}`
  accountValue: string
  totalRawUsd: string
  totalVaultEquity: string
  spotBalances: Array<{ coin: string; total: string; hold: string }>
  spotAssetCtxs: Array<{ coin: string; markPx?: string | null; midPx?: string | null }>
  serverTime: number
  crossAccountValue: string
  crossNtlPos: string
  crossMaintenanceMarginUsed: string
  unrealizedPnls: ReadonlyArray<string>
}> = {}): WebData2Response {
  const accountValue = partial.accountValue ?? '0'
  const crossAccountValue = partial.crossAccountValue ?? accountValue
  const assetPositions = (partial.unrealizedPnls ?? []).map((unrealizedPnl) => ({
    position: { unrealizedPnl },
  }))
  return {
    clearinghouseState: {
      marginSummary: {
        accountValue,
        totalNtlPos: '0',
        totalRawUsd: partial.totalRawUsd ?? '0',
        totalMarginUsed: '0',
      },
      crossMarginSummary: {
        accountValue: crossAccountValue,
        totalNtlPos: partial.crossNtlPos ?? '0',
        totalRawUsd: partial.totalRawUsd ?? '0',
        totalMarginUsed: '0',
      },
      crossMaintenanceMarginUsed: partial.crossMaintenanceMarginUsed ?? '0',
      withdrawable: '0',
      assetPositions,
      time: 0,
    },
    leadingVaults: [],
    totalVaultEquity: partial.totalVaultEquity ?? '0',
    openOrders: [],
    agentAddress: null,
    agentValidUntil: null,
    cumLedger: '0',
    meta: { universe: [], marginTables: [] },
    assetCtxs: [],
    serverTime: partial.serverTime ?? 0,
    isVault: false,
    user: partial.user ?? '0xabcdef0123456789abcdef0123456789abcdef01',
    twapStates: [],
    spotState: { balances: partial.spotBalances ?? [], evmEscrows: [] },
    spotAssetCtxs: partial.spotAssetCtxs ?? [],
  } as unknown as WebData2Response
}

export function buildUserFees(partial: {
  userCrossRate?: string
  userAddRate?: string
  userSpotCrossRate?: string
  userSpotAddRate?: string
} = {}): UserFeesResponse {
  return {
    dailyUserVlm: [],
    feeSchedule: {
      cross: '0',
      add: '0',
      spotCross: '0',
      spotAdd: '0',
      tiers: { vip: [], mm: [] },
      referralDiscount: '0',
      stakingDiscountTiers: [],
    },
    userCrossRate: partial.userCrossRate ?? '0.00045',
    userAddRate: partial.userAddRate ?? '0.0001',
    userSpotCrossRate: partial.userSpotCrossRate ?? '0.0007',
    userSpotAddRate: partial.userSpotAddRate ?? '0.0004',
    activeReferralDiscount: '0',
    trial: null,
    feeTrialEscrow: '0',
    nextTrialAvailableTimestamp: null,
    stakingLink: null,
    activeStakingDiscount: { bpsOfMaxSupply: '0', discount: '0' },
  } as unknown as UserFeesResponse
}

export function buildPortfolioPeriods(): PortfolioResponse {
  const empty = { accountValueHistory: [] as Array<[number, string]>, pnlHistory: [] as Array<[number, string]>, vlm: '0' }
  return [
    ['day', empty],
    ['week', empty],
    ['month', empty],
    ['allTime', empty],
    ['perpDay', empty],
    ['perpWeek', empty],
    ['perpMonth', empty],
    ['perpAllTime', empty],
  ] as unknown as PortfolioResponse
}

export function buildDelegatorSummary(partial: Partial<DelegatorSummaryResponse> = {}): DelegatorSummaryResponse {
  return {
    delegated: partial.delegated ?? '0',
    undelegated: partial.undelegated ?? '0',
    totalPendingWithdrawal: partial.totalPendingWithdrawal ?? '0',
    nPendingWithdrawals: partial.nPendingWithdrawals ?? 0,
  }
}

export function buildSpotMetaAndAssetCtxs(
  meta: Partial<SpotMetaResponse> = {},
  ctxs: SpotMetaAndAssetCtxsResponse[1] = [],
): SpotMetaAndAssetCtxsResponse {
  const fullMeta: SpotMetaResponse = {
    universe: meta.universe ?? [],
    tokens: meta.tokens ?? [],
  }
  return [fullMeta, ctxs]
}

export function buildBorrowLendUserState(
  partial: Partial<BorrowLendUserStateResponse> = {},
): BorrowLendUserStateResponse {
  return {
    tokenToState: partial.tokenToState ?? [],
    health: partial.health ?? 'healthy',
    healthFactor: partial.healthFactor ?? null,
  } as BorrowLendUserStateResponse
}

const EMPTY_PORTFOLIO_FAMILY = {
  pnl: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
  volume: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
} as const

const EMPTY_PULL_SNAPSHOT: HyperliquidPullSnapshot = {
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
  // USDC (spot token index 0) is the default-dex unified collateral.
  unifiedCollateralTokenIndices: new Set([0]),
}

/**
 * Test-only fake `HyperliquidPullService`. Defaults to an empty snapshot.
 * Tests can call `setSnapshot` to push an updated value to all subscribers,
 * mirroring what the real pull service does on each tick.
 */
export interface FakePullService extends HyperliquidPullService {
  setSnapshot(next: Partial<HyperliquidPullSnapshot>): void
}

export function buildFakePullService(initial: Partial<HyperliquidPullSnapshot> = {}): FakePullService {
  let snapshot: HyperliquidPullSnapshot = { ...EMPTY_PULL_SNAPSHOT, ...initial }
  const listeners = new Set<(s: HyperliquidPullSnapshot) => void>()
  return {
    current: () => snapshot,
    subscribe(onUpdate): Unsubscribe {
      listeners.add(onUpdate)
      onUpdate(snapshot)
      return () => {
        listeners.delete(onUpdate)
      }
    },
    refreshAddress: () => {},
    stop: () => {},
    setSnapshot(next) {
      snapshot = { ...snapshot, ...next }
      for (const l of listeners) l(snapshot)
    },
  }
}

/**
 * Test-only fake `HyperliquidGateway`. All methods err-by-default; override
 * via `partial`. Use this instead of constructing inline gateway literals so
 * adding a new gateway method only requires updating this fixture.
 */
export function buildFakeGateway(partial: Partial<HyperliquidGateway> = {}): HyperliquidGateway {
  const errFor = (label: string) =>
    () => errAsync(new HyperliquidGatewayError('network', `not stubbed: ${label}`))
  return {
    fetchWebData2: partial.fetchWebData2 ?? errFor('fetchWebData2'),
    subscribeWebData2: partial.subscribeWebData2 ?? errFor('subscribeWebData2'),
    subscribeAllDexsClearinghouseState:
      partial.subscribeAllDexsClearinghouseState ??
      errFor('subscribeAllDexsClearinghouseState'),
    getPortfolio: partial.getPortfolio ?? errFor('getPortfolio'),
    getUserFees: partial.getUserFees ?? errFor('getUserFees'),
    getDelegatorSummary: partial.getDelegatorSummary ?? errFor('getDelegatorSummary'),
    getSpotMetaAndAssetCtxs:
      partial.getSpotMetaAndAssetCtxs ?? (() => okAsync(buildSpotMetaAndAssetCtxs())),
    getPerpDexs: partial.getPerpDexs ?? (() => okAsync([] as PerpDexsResponse)),
    getAllPerpMetas:
      partial.getAllPerpMetas ?? (() => okAsync([] as AllPerpMetasResponse)),
    getMetaAndAssetCtxs: partial.getMetaAndAssetCtxs ?? errFor('getMetaAndAssetCtxs'),
    getPerpMetaAndAssetCtxs:
      partial.getPerpMetaAndAssetCtxs ?? errFor('getPerpMetaAndAssetCtxs'),
    getCandleSnapshot: partial.getCandleSnapshot ?? errFor('getCandleSnapshot'),
    subscribeCandle: partial.subscribeCandle ?? errFor('subscribeCandle'),
    subscribeL2Book: partial.subscribeL2Book ?? errFor('subscribeL2Book'),
    subscribeTradesStream: partial.subscribeTradesStream ?? errFor('subscribeTradesStream'),
    subscribeActiveAssetCtx:
      partial.subscribeActiveAssetCtx ?? errFor('subscribeActiveAssetCtx'),
    subscribeActiveSpotAssetCtx:
      partial.subscribeActiveSpotAssetCtx ?? errFor('subscribeActiveSpotAssetCtx'),
    getBorrowLendUserState:
      partial.getBorrowLendUserState ?? (() => okAsync(buildBorrowLendUserState())),
    getUserFillsByTime: partial.getUserFillsByTime ?? errFor('getUserFillsByTime'),
    getUserFunding: partial.getUserFunding ?? errFor('getUserFunding'),
    getUserBorrowLendInterest:
      partial.getUserBorrowLendInterest ?? errFor('getUserBorrowLendInterest'),
    getUserNonFundingLedgerUpdates:
      partial.getUserNonFundingLedgerUpdates ?? errFor('getUserNonFundingLedgerUpdates'),
    getTwapHistory: partial.getTwapHistory ?? errFor('getTwapHistory'),
    getHistoricalOrders: partial.getHistoricalOrders ?? errFor('getHistoricalOrders'),
    queryUserAbstraction: partial.queryUserAbstraction ?? (() => okAsync('default')),
  } as unknown as HyperliquidGateway
}

/**
 * Verified `SpotAssetCtxSchema` field set (from `@nktkas/hyperliquid@0.32.2`
 * type defs, RESEARCH.md Code Examples): `markPx`, `midPx`, `prevDayPx`,
 * `dayNtlVlm`, `circulatingSupply`, `coin`, `totalSupply`, `dayBaseVlm`.
 * Crucially NO `oraclePx`, NO `funding`, NO `openInterest`, NO `premium` —
 * a spot ctx structurally cannot produce the perp-only `Ticker` fields.
 * `midPx` is `string | null` (projection must not throw on null).
 */
export interface FakeSpotAssetCtx {
  coin: string
  markPx: string
  midPx: string | null
  prevDayPx: string
  dayNtlVlm: string
  dayBaseVlm: string
  circulatingSupply: string
  totalSupply: string
}

export interface FakeActiveSpotAssetCtxEvent {
  coin: string
  ctx: FakeSpotAssetCtx
}

/**
 * Builds an `activeSpotAssetCtx`-shaped WS event for the verified spot ctx
 * field set. Defaults to safe stringified zeros; override via `partial`.
 */
export function buildActiveSpotAssetCtxEvent(
  partial: Partial<FakeSpotAssetCtx> & { coin?: string } = {},
): FakeActiveSpotAssetCtxEvent {
  const coin = partial.coin ?? '@107'
  return {
    coin,
    ctx: {
      coin,
      markPx: partial.markPx ?? '0',
      midPx: partial.midPx ?? '0',
      prevDayPx: partial.prevDayPx ?? '0',
      dayNtlVlm: partial.dayNtlVlm ?? '0',
      dayBaseVlm: partial.dayBaseVlm ?? '0',
      circulatingSupply: partial.circulatingSupply ?? '0',
      totalSupply: partial.totalSupply ?? '0',
    },
  }
}

export interface FakeSpotCtxCapture {
  /** The gateway object to hand to the reader (spread of overrides + spot fake). */
  gateway: HyperliquidGateway
  /** The coin string the reader passed to `subscribeActiveSpotAssetCtx`, or null if never called. */
  capturedCoin(): string | null
  /** Emit a spot ctx event to the captured listener (throws if not yet subscribed). */
  emit(event: FakeActiveSpotAssetCtxEvent): void
  /** Whether the reader ever subscribed via the spot ctx channel. */
  subscribed(): boolean
}

/**
 * Extends `buildFakeGateway` with a `subscribeActiveSpotAssetCtx(coin, listener)`
 * fake mirroring the existing `subscribeActiveAssetCtx` fake: captures the coin,
 * exposes a manual `emit`, returns an unsubscribe handle.
 *
 * The `subscribeActiveSpotAssetCtx` gateway method is added to the
 * `HyperliquidGateway` port in plan 03-02; until then this fixture attaches it
 * structurally so the RED reader spot-ctx tests can drive it.
 */
export function buildFakeGatewayWithSpotCtx(
  partial: Partial<HyperliquidGateway> = {},
): FakeSpotCtxCapture {
  let listener: ((event: FakeActiveSpotAssetCtxEvent) => void) | null = null
  let coin: string | null = null
  const base = buildFakeGateway(partial)
  const spot = {
    subscribeActiveSpotAssetCtx: (
      c: string,
      l: (event: FakeActiveSpotAssetCtxEvent) => void,
    ) => {
      coin = c
      listener = l
      return okAsync({
        unsubscribe: () => Promise.resolve(),
        failureSignal: new AbortController().signal,
      })
    },
  }
  return {
    gateway: { ...base, ...spot } as unknown as HyperliquidGateway,
    capturedCoin: () => coin,
    emit(event) {
      if (listener === null) throw new Error('subscribeActiveSpotAssetCtx not yet called')
      listener(event)
    },
    subscribed: () => listener !== null,
  }
}

export interface LogRecord {
  readonly level: LogLevel
  readonly fields: LogFields
  readonly message: string
}

export interface FakeLogger {
  readonly logger: Logger
  readonly records: ReadonlyArray<LogRecord>
}

/**
 * Test-only `Logger` that captures every record into `records`.
 * `child()` merges bound fields into subsequent records, mirroring the real
 * `createLogger` semantics. No level filtering — tests assert on level explicitly.
 */
export function buildFakeLogger(): FakeLogger {
  const records: LogRecord[] = []

  function build(bound: LogFields): Logger {
    function emit(level: LogLevel, fields: LogFields, message: string): void {
      records.push({ level, fields: { ...bound, ...fields }, message })
    }
    return {
      debug: (fields, message) => emit('debug', fields, message),
      info: (fields, message) => emit('info', fields, message),
      warn: (fields, message) => emit('warn', fields, message),
      error: (fields, message) => emit('error', fields, message),
      child: (fields) => build({ ...bound, ...fields }),
    }
  }

  return { logger: build({}), records }
}

// Imports kept at file end to avoid unused-import warnings on barrel edits.
export type { WalletAddress }
