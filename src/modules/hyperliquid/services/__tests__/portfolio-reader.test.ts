import { describe, it, expect } from 'vitest'
import { okAsync } from 'neverthrow'
import type { PortfolioSnapshot, WalletAddress } from '@/modules/shared/domain'
import type {
  AllDexsClearinghouseStateEvent,
  PortfolioResponse,
  WebData2Response,
} from '../../gateway/sdk-types'
import { createHyperliquidPortfolioReader, projectMarginSummary } from '../portfolio-reader'
import type { WebData2Stream } from '../web-data2-stream'
import type { AllDexsClearinghouseStateStream } from '../all-dexs-clearinghouse-state-stream'
import {
  buildFakeGateway,
  buildFakeLogger,
  buildFakePullService,
  buildWebData2,
} from '../__fixtures__/web-data2'

const ADDR = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as WalletAddress

const PORTFOLIO: PortfolioResponse = [
  ['day', { accountValueHistory: [[1, '100'], [2, '110']], pnlHistory: [[1, '5']], vlm: '0' }],
  ['week', { accountValueHistory: [[3, '120']], pnlHistory: [[3, '7'], [4, '8']], vlm: '0' }],
  ['month', { accountValueHistory: [[5, '130']], pnlHistory: [[5, '10']], vlm: '0' }],
  ['allTime', { accountValueHistory: [[6, '140']], pnlHistory: [[6, '12']], vlm: '0' }],
  ['perpDay', { accountValueHistory: [[7, '150']], pnlHistory: [[7, '15']], vlm: '0' }],
  ['perpWeek', { accountValueHistory: [[8, '160']], pnlHistory: [[8, '17']], vlm: '0' }],
  ['perpMonth', { accountValueHistory: [[9, '170']], pnlHistory: [[9, '20']], vlm: '0' }],
  ['perpAllTime', { accountValueHistory: [[10, '180']], pnlHistory: [[10, '22']], vlm: '0' }],
] as unknown as PortfolioResponse

// Real values curled from the debug address (2026-06-11) — day and allTime are
// distinct, proving the snapshot tracks the period, not a frozen 24H bucket.
const FAMILY_COMBINED = {
  pnl: { '24H': -0.357, '7D': -0.887, '30D': -0.575, AllTime: 0.381 },
  volume: { '24H': 334.95, '7D': 2_571.67, '30D': 2_571.67, AllTime: 2_583.48 },
} as const
const FAMILY_PERPS = {
  pnl: { '24H': -0.4, '7D': -0.9, '30D': -0.6, AllTime: 0.5 },
  volume: { '24H': 300.0, '7D': 2_552.02, '30D': 2_552.02, AllTime: 2_560.0 },
} as const

function fakeStream(): {
  stream: WebData2Stream
  emit: (s: WebData2Response) => void
} {
  const listeners = new Set<(s: WebData2Response) => void>()
  let latest: WebData2Response | null = null
  return {
    stream: {
      current: () => latest,
      subscribe(onUpdate) {
        listeners.add(onUpdate)
        if (latest !== null) onUpdate(latest)
        return () => listeners.delete(onUpdate)
      },
      connectionStatus: { status: () => 'connected', subscribe: () => () => {} },
      refreshAddress: () => {},
      stop: () => {},
    },
    emit(s) {
      latest = s
      for (const listener of listeners) listener(s)
    },
  }
}

function fakeAllDexsStream(): {
  stream: AllDexsClearinghouseStateStream
  emit: (e: AllDexsClearinghouseStateEvent) => void
} {
  const listeners = new Set<(e: AllDexsClearinghouseStateEvent) => void>()
  let latest: AllDexsClearinghouseStateEvent | null = null
  return {
    stream: {
      current: () => latest,
      subscribe(onUpdate) {
        listeners.add(onUpdate)
        if (latest !== null) onUpdate(latest)
        return () => listeners.delete(onUpdate)
      },
      connectionStatus: { status: () => 'connected', subscribe: () => () => {} },
      refreshAddress: () => {},
      stop: () => {},
    },
    emit(e) {
      latest = e
      for (const listener of listeners) listener(e)
    },
  }
}

/** A never-emitting all-dexs stream — the projection falls back to the main-dex
 *  webData2 figures, preserving pre-HIP-3 behavior. Default for tests that don't
 *  exercise multi-dex perp equity. */
function emptyAllDexsStream(): AllDexsClearinghouseStateStream {
  return fakeAllDexsStream().stream
}

/** Build an all-dexs clearinghouse event: one entry per dex (`''` = main), each
 *  with its perp `accountValue` and optional per-position unrealized PnLs. */
function buildAllDexsEvent(
  dexes: ReadonlyArray<{
    readonly dex: string
    readonly accountValue: string
    readonly unrealizedPnls?: ReadonlyArray<string>
  }>,
): AllDexsClearinghouseStateEvent {
  const clearinghouseStates = dexes.map(({ dex, accountValue, unrealizedPnls }) => [
    dex,
    {
      marginSummary: { accountValue, totalNtlPos: '0', totalRawUsd: '0', totalMarginUsed: '0' },
      crossMarginSummary: { accountValue: '0', totalNtlPos: '0', totalRawUsd: '0', totalMarginUsed: '0' },
      crossMaintenanceMarginUsed: '0',
      withdrawable: '0',
      assetPositions: (unrealizedPnls ?? []).map((unrealizedPnl) => ({
        type: 'oneWay',
        position: { unrealizedPnl },
      })),
      time: 0,
    },
  ])
  return { user: ADDR, clearinghouseStates } as unknown as AllDexsClearinghouseStateEvent
}

describe('createHyperliquidPortfolioReader — subscribeSnapshot', () => {
  it('scope=all: accountValue = perps + spot + vault, with spot prices from pull cache', () => {
    const fake = fakeStream()
    const pull = buildFakePullService({ spotPrices: new Map([['USDC', 1], ['ETH', 2_000]]) })
    const gateway = buildFakeGateway({ getPortfolio: () => okAsync(PORTFOLIO) })
    const reader = createHyperliquidPortfolioReader(fake.stream, emptyAllDexsStream(), pull, gateway, () => ADDR, buildFakeLogger().logger)
    let latest: number | null = null
    reader.subscribeSnapshot('all', (snap) => { latest = snap.accountValue })
    fake.emit(buildWebData2({
      accountValue: '1000',
      totalVaultEquity: '50',
      spotBalances: [{ coin: 'ETH', total: '0.1', hold: '0' }],
    }))
    // perps 1000 + spot (0.1 * 2000 = 200) + vault 50 = 1250
    expect(latest).toBe(1250)
  })

  it('scope=perps: accountValue = perpsEquity only', () => {
    const fake = fakeStream()
    const pull = buildFakePullService()
    const reader = createHyperliquidPortfolioReader(fake.stream, emptyAllDexsStream(), pull, buildFakeGateway(), () => ADDR, buildFakeLogger().logger)
    let latest: number | null = null
    reader.subscribeSnapshot('perps', (snap) => { latest = snap.accountValue })
    fake.emit(buildWebData2({
      accountValue: '1000',
      totalVaultEquity: '50',
      spotBalances: [{ coin: 'ETH', total: '0.1', hold: '0' }],
    }))
    expect(latest).toBe(1000)
  })

  it('snapshot exposes spot/perps equity, perpsPnl from positions, and pull-fed pnl/volume/14d', () => {
    const fake = fakeStream()
    const pull = buildFakePullService({
      portfolioCombined: FAMILY_COMBINED,
      portfolioPerps: FAMILY_PERPS,
      fourteenDayVolume: 70_000,
    })
    const reader = createHyperliquidPortfolioReader(fake.stream, emptyAllDexsStream(), pull, buildFakeGateway(), () => ADDR, buildFakeLogger().logger)
    const seen: PortfolioSnapshot[] = []
    reader.subscribeSnapshot('all', (s) => seen.push(s))
    fake.emit(buildWebData2({
      accountValue: '100',
      serverTime: 999,
      spotBalances: [{ coin: 'USDC', total: '25', hold: '0' }],
    }))
    expect(seen).toHaveLength(1)
    expect(seen[0].perpsEquity).toBe(100)
    expect(seen[0].spotEquity).toBe(25)
    expect(seen[0].timestamp).toBe(999)
    // The 24H bucket is the same value the old scalar exposed.
    expect(seen[0].pnl['24H']).toBe(FAMILY_COMBINED.pnl['24H'])
    expect(seen[0].volume['24H']).toBe(FAMILY_COMBINED.volume['24H'])
    expect(seen[0].fourteenDayVolume).toBe(70_000)
  })

  it('scope=all: snapshot pnl/volume are window-keyed — AllTime differs from 24H (the F1 bug)', () => {
    const fake = fakeStream()
    const pull = buildFakePullService({
      portfolioCombined: FAMILY_COMBINED,
      portfolioPerps: FAMILY_PERPS,
    })
    const reader = createHyperliquidPortfolioReader(fake.stream, emptyAllDexsStream(), pull, buildFakeGateway(), () => ADDR, buildFakeLogger().logger)
    let latest: PortfolioSnapshot | null = null
    reader.subscribeSnapshot('all', (s) => { latest = s })
    fake.emit(buildWebData2({ accountValue: '100' }))
    // The whole bug: All-Time must NOT equal the 24H bucket.
    expect(latest!.pnl.AllTime).not.toBe(latest!.pnl['24H'])
    expect(latest!.volume.AllTime).not.toBe(latest!.volume['24H'])
    expect(latest!.pnl).toEqual(FAMILY_COMBINED.pnl)
    expect(latest!.volume).toEqual(FAMILY_COMBINED.volume)
  })

  it('scope=perps: snapshot pnl/volume use the perp bucket family (mirrors mapToPeriod)', () => {
    const fake = fakeStream()
    const pull = buildFakePullService({
      portfolioCombined: FAMILY_COMBINED,
      portfolioPerps: FAMILY_PERPS,
    })
    const reader = createHyperliquidPortfolioReader(fake.stream, emptyAllDexsStream(), pull, buildFakeGateway(), () => ADDR, buildFakeLogger().logger)
    let latest: PortfolioSnapshot | null = null
    reader.subscribeSnapshot('perps', (s) => { latest = s })
    fake.emit(buildWebData2({ accountValue: '100' }))
    expect(latest!.pnl).toEqual(FAMILY_PERPS.pnl)
    expect(latest!.volume).toEqual(FAMILY_PERPS.volume)
    // perp family genuinely differs from combined (perpWeek vlm ≠ week vlm live).
    expect(latest!.volume['7D']).not.toBe(FAMILY_COMBINED.volume['7D'])
  })

  it('emits a debug projection record per update with module and accountValue fields', () => {
    const fake = fakeStream()
    const fakeLogger = buildFakeLogger()
    const reader = createHyperliquidPortfolioReader(
      fake.stream,
      emptyAllDexsStream(),
      buildFakePullService(),
      buildFakeGateway(),
      () => ADDR,
      fakeLogger.logger,
    )
    reader.subscribeSnapshot('all', () => {})
    fake.emit(buildWebData2({ accountValue: '1000' }))
    const projections = fakeLogger.records.filter(
      (r) => r.level === 'debug' && r.message === 'projection',
    )
    expect(projections.length).toBeGreaterThanOrEqual(1)
    expect(projections[0].fields.module).toBe('hyperliquid-portfolio-reader')
    expect(projections[0].fields).toHaveProperty('accountValue')
    expect(projections[0].fields).toHaveProperty('scope', 'all')
  })

  it('unified account: scope=all accountValue = spot pool + vault (perp summary ignored)', () => {
    const fake = fakeStream()
    const pull = buildFakePullService({
      abstractionMode: 'unifiedAccount',
      spotPrices: new Map([['USDC', 1], ['ETH', 2_000]]),
    })
    const reader = createHyperliquidPortfolioReader(fake.stream, emptyAllDexsStream(), pull, buildFakeGateway(), () => ADDR, buildFakeLogger().logger)
    let latest: PortfolioSnapshot | null = null
    reader.subscribeSnapshot('all', (s) => { latest = s })
    // marginSummary ~0 (not meaningful) but real spot + vault funds present.
    fake.emit(buildWebData2({
      accountValue: '0',
      totalVaultEquity: '50',
      spotBalances: [{ coin: 'ETH', total: '0.1', hold: '0' }, { coin: 'USDC', total: '300', hold: '0' }],
    }))
    // spot (0.1 * 2000 = 200) + USDC 300 + vault 50 = 550. No phantom ~0 perps.
    expect(latest!.accountValue).toBe(550)
    expect(latest!.spotEquity).toBe(500)
    expect(latest!.perpsEquity).toBe(0)
  })

  it('unified account: scope=perps is the perp-tradeable collateral (spot pool, vault excluded)', () => {
    const fake = fakeStream()
    const pull = buildFakePullService({
      abstractionMode: 'portfolioMargin',
      spotPrices: new Map([['USDC', 1]]),
    })
    const reader = createHyperliquidPortfolioReader(fake.stream, emptyAllDexsStream(), pull, buildFakeGateway(), () => ADDR, buildFakeLogger().logger)
    let latest: PortfolioSnapshot | null = null
    reader.subscribeSnapshot('perps', (s) => { latest = s })
    fake.emit(buildWebData2({
      accountValue: '0',
      totalVaultEquity: '50',
      spotBalances: [{ coin: 'USDC', total: '300', hold: '0' }],
    }))
    // 300 spot only — vault (50) is NOT order margin and the ~0 perp summary is
    // ignored. The 'all' scope (separate test above) keeps the vault → 350.
    expect(latest!.accountValue).toBe(300)
    expect(latest!.perpsEquity).toBe(0)
  })

  it('unified scope=perps excludes volatile (non-collateral) spot holdings; all includes them (bug #1)', () => {
    const fake = fakeStream()
    // Default collateral indices {0} + empty symbol index → only USDC is eligible.
    const pull = buildFakePullService({
      abstractionMode: 'unifiedAccount',
      spotPrices: new Map([['USDC', 1], ['HYPE', 50]]),
    })
    const reader = createHyperliquidPortfolioReader(fake.stream, emptyAllDexsStream(), pull, buildFakeGateway(), () => ADDR, buildFakeLogger().logger)
    const state = () => buildWebData2({
      accountValue: '0',
      totalVaultEquity: '0',
      spotBalances: [{ coin: 'USDC', total: '300', hold: '0' }, { coin: 'HYPE', total: '2', hold: '0' }],
    })

    let perps: PortfolioSnapshot | null = null
    reader.subscribeSnapshot('perps', (s) => { perps = s })
    fake.emit(state())
    // HYPE (2 * 50 = 100) is NOT collateral → excluded from buying power. USDC 300 only.
    expect(perps!.accountValue).toBe(300)

    let all: PortfolioSnapshot | null = null
    reader.subscribeSnapshot('all', (s) => { all = s })
    fake.emit(state())
    // Net worth still counts the volatile holding: 300 + 100 = 400.
    expect(all!.accountValue).toBe(400)
    expect(all!.spotEquity).toBe(400)
  })

  it('unified scope=perps counts a dex collateral stable resolved from the collateral indices', () => {
    const fake = fakeStream()
    // Token index 5 → 'USDH' is an advertised dex collateral; USDC (0) always seeded.
    const pull = buildFakePullService({
      abstractionMode: 'unifiedAccount',
      spotPrices: new Map([['USDC', 1], ['USDH', 1], ['HYPE', 50]]),
      unifiedCollateralTokenIndices: new Set([0, 5]),
      spotTokenSymbolByIndex: new Map([[5, 'USDH']]),
    })
    const reader = createHyperliquidPortfolioReader(fake.stream, emptyAllDexsStream(), pull, buildFakeGateway(), () => ADDR, buildFakeLogger().logger)
    let perps: PortfolioSnapshot | null = null
    reader.subscribeSnapshot('perps', (s) => { perps = s })
    fake.emit(buildWebData2({
      accountValue: '0',
      totalVaultEquity: '0',
      spotBalances: [
        { coin: 'USDC', total: '300', hold: '0' },
        { coin: 'USDH', total: '100', hold: '0' },
        { coin: 'HYPE', total: '2', hold: '0' },
      ],
    }))
    // USDC 300 + USDH 100 (collateral) = 400; HYPE 100 (volatile) excluded.
    expect(perps!.accountValue).toBe(400)
  })

  it('unknown mode (null) renders classic: accountValue includes the perp summary', () => {
    const fake = fakeStream()
    const pull = buildFakePullService({ abstractionMode: null, spotPrices: new Map([['USDC', 1]]) })
    const reader = createHyperliquidPortfolioReader(fake.stream, emptyAllDexsStream(), pull, buildFakeGateway(), () => ADDR, buildFakeLogger().logger)
    let latest: PortfolioSnapshot | null = null
    reader.subscribeSnapshot('all', (s) => { latest = s })
    fake.emit(buildWebData2({
      accountValue: '1000',
      totalVaultEquity: '50',
      spotBalances: [{ coin: 'USDC', total: '25', hold: '0' }],
    }))
    expect(latest!.accountValue).toBe(1075)
    expect(latest!.perpsEquity).toBe(1000)
  })

  it('perpsPnl is the sum of unrealizedPnl across all positions', () => {
    const fake = fakeStream()
    const pull = buildFakePullService()
    const reader = createHyperliquidPortfolioReader(fake.stream, emptyAllDexsStream(), pull, buildFakeGateway(), () => ADDR, buildFakeLogger().logger)
    let latest: PortfolioSnapshot | null = null
    reader.subscribeSnapshot('all', (s) => { latest = s })
    const state = buildWebData2({ accountValue: '100' })
    const stateWithPositions: WebData2Response = {
      ...state,
      clearinghouseState: {
        ...state.clearinghouseState,
        assetPositions: [
          { type: 'oneWay', position: { unrealizedPnl: '12.5' } as never } as never,
          { type: 'oneWay', position: { unrealizedPnl: '-2' } as never } as never,
        ],
      },
    }
    fake.emit(stateWithPositions)
    expect(latest!.perpsPnl).toBe(10.5)
  })

  it('unified: scope=all adds the HIP-3 dex perp equity that webData2 misses (the bug)', () => {
    const fake = fakeStream()
    const allDexs = fakeAllDexsStream()
    const pull = buildFakePullService({
      abstractionMode: 'unifiedAccount',
      spotPrices: new Map([['USDC', 1]]),
    })
    const reader = createHyperliquidPortfolioReader(
      fake.stream,
      allDexs.stream,
      pull,
      buildFakeGateway(),
      () => ADDR,
      buildFakeLogger().logger,
    )
    let latest: PortfolioSnapshot | null = null
    reader.subscribeSnapshot('all', (s) => { latest = s })
    // The open position is on the `xyz` HIP-3 dex (perp equity 3.23, uPnL 0.21);
    // the main dex is phantom-0 and webData2 spot is the hold-netted available.
    allDexs.emit(buildAllDexsEvent([
      { dex: '', accountValue: '0' },
      { dex: 'xyz', accountValue: '3.23', unrealizedPnls: ['0.21'] },
    ]))
    fake.emit(buildWebData2({
      accountValue: '0',
      totalVaultEquity: '12.71',
      spotBalances: [{ coin: 'USDC', total: '1.62', hold: '0' }],
    }))
    // Net worth = available spot 1.62 + all-dexs perp equity 3.23 + vault 12.71.
    expect(latest!.accountValue).toBeCloseTo(17.56, 5)
    expect(latest!.perpsEquity).toBeCloseTo(3.23, 5)
    expect(latest!.perpsPnl).toBeCloseTo(0.21, 5)
  })

  it('unified: scope=perps (buying power) ignores HIP-3 perp equity — only collateral spot', () => {
    const fake = fakeStream()
    const allDexs = fakeAllDexsStream()
    const pull = buildFakePullService({
      abstractionMode: 'unifiedAccount',
      spotPrices: new Map([['USDC', 1]]),
    })
    const reader = createHyperliquidPortfolioReader(
      fake.stream,
      allDexs.stream,
      pull,
      buildFakeGateway(),
      () => ADDR,
      buildFakeLogger().logger,
    )
    let latest: PortfolioSnapshot | null = null
    reader.subscribeSnapshot('perps', (s) => { latest = s })
    allDexs.emit(buildAllDexsEvent([{ dex: 'xyz', accountValue: '3.23', unrealizedPnls: ['0.21'] }]))
    fake.emit(buildWebData2({
      accountValue: '0',
      totalVaultEquity: '12.71',
      spotBalances: [{ coin: 'USDC', total: '1.62', hold: '0' }],
    }))
    // Buying power stays the perp-tradeable collateral (available spot) — HIP-3
    // isolated equity is NOT main-dex order margin (account-modes §3, untouched).
    expect(latest!.accountValue).toBeCloseTo(1.62, 5)
  })

  it('segregated: scope=all sums every dex perp equity; scope=perps stays main-dex only', () => {
    const allDexsEvent = buildAllDexsEvent([
      { dex: '', accountValue: '100' },
      { dex: 'xyz', accountValue: '40', unrealizedPnls: ['5'] },
    ])
    const pull = buildFakePullService({ spotPrices: new Map([['USDC', 1]]) }) // default → segregated

    const allFake = fakeStream()
    const allDexsAll = fakeAllDexsStream()
    const allReader = createHyperliquidPortfolioReader(
      allFake.stream, allDexsAll.stream, pull, buildFakeGateway(), () => ADDR, buildFakeLogger().logger,
    )
    let all: PortfolioSnapshot | null = null
    allReader.subscribeSnapshot('all', (s) => { all = s })
    allDexsAll.emit(allDexsEvent)
    allFake.emit(buildWebData2({
      accountValue: '100',
      totalVaultEquity: '10',
      spotBalances: [{ coin: 'USDC', total: '25', hold: '0' }],
    }))
    // 'all' = (100 main + 40 HIP-3) perp + 25 spot + 10 vault = 175; perpsPnl = 5.
    expect(all!.accountValue).toBe(175)
    expect(all!.perpsEquity).toBe(140)
    expect(all!.perpsPnl).toBe(5)

    const perpsFake = fakeStream()
    const allDexsPerps = fakeAllDexsStream()
    const perpsReader = createHyperliquidPortfolioReader(
      perpsFake.stream, allDexsPerps.stream, pull, buildFakeGateway(), () => ADDR, buildFakeLogger().logger,
    )
    let perps: PortfolioSnapshot | null = null
    perpsReader.subscribeSnapshot('perps', (s) => { perps = s })
    allDexsPerps.emit(allDexsEvent)
    perpsFake.emit(buildWebData2({ accountValue: '100', totalVaultEquity: '10' }))
    // 'perps' buying power = MAIN-dex perp equity only (100), HIP-3 40 excluded.
    expect(perps!.accountValue).toBe(100)
  })
})

describe('createHyperliquidPortfolioReader — getHistory', () => {
  it('null address → wallet-not-connected', async () => {
    const fake = fakeStream()
    const reader = createHyperliquidPortfolioReader(
      fake.stream,
      emptyAllDexsStream(),
      buildFakePullService(),
      buildFakeGateway({ getPortfolio: () => okAsync(PORTFOLIO) }),
      () => null,
      buildFakeLogger().logger,
    )
    const result = await reader.getHistory('accountValue', '24H', 'all')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('wallet-not-connected')
  })

  it('volume metric → unsupported-metric', async () => {
    const fake = fakeStream()
    const reader = createHyperliquidPortfolioReader(
      fake.stream,
      emptyAllDexsStream(),
      buildFakePullService(),
      buildFakeGateway({ getPortfolio: () => okAsync(PORTFOLIO) }),
      () => ADDR,
      buildFakeLogger().logger,
    )
    const result = await reader.getHistory('volume', '24H', 'all')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('unsupported-metric')
  })

  it('accountValue 24H all → day accountValueHistory', async () => {
    const fake = fakeStream()
    const reader = createHyperliquidPortfolioReader(
      fake.stream,
      emptyAllDexsStream(),
      buildFakePullService(),
      buildFakeGateway({ getPortfolio: () => okAsync(PORTFOLIO) }),
      () => ADDR,
      buildFakeLogger().logger,
    )
    const result = await reader.getHistory('accountValue', '24H', 'all')
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value).toHaveLength(2)
    expect(result.value[0].timestamp).toBe(1)
    expect(result.value[0].value).toBe(100)
  })

  it('pnl 7D all → week pnlHistory', async () => {
    const fake = fakeStream()
    const reader = createHyperliquidPortfolioReader(
      fake.stream,
      emptyAllDexsStream(),
      buildFakePullService(),
      buildFakeGateway({ getPortfolio: () => okAsync(PORTFOLIO) }),
      () => ADDR,
      buildFakeLogger().logger,
    )
    const result = await reader.getHistory('pnl', '7D', 'all')
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value).toHaveLength(2)
    expect(result.value[0].value).toBe(7)
  })

  it('accountValue 30D all → month accountValueHistory', async () => {
    const fake = fakeStream()
    const reader = createHyperliquidPortfolioReader(
      fake.stream,
      emptyAllDexsStream(),
      buildFakePullService(),
      buildFakeGateway({ getPortfolio: () => okAsync(PORTFOLIO) }),
      () => ADDR,
      buildFakeLogger().logger,
    )
    const result = await reader.getHistory('accountValue', '30D', 'all')
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value[0].value).toBe(130)
  })

  it('accountValue AllTime all → allTime accountValueHistory', async () => {
    const fake = fakeStream()
    const reader = createHyperliquidPortfolioReader(
      fake.stream,
      emptyAllDexsStream(),
      buildFakePullService(),
      buildFakeGateway({ getPortfolio: () => okAsync(PORTFOLIO) }),
      () => ADDR,
      buildFakeLogger().logger,
    )
    const result = await reader.getHistory('accountValue', 'AllTime', 'all')
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value[0].value).toBe(140)
  })

  it('accountValue 24H perps → perpDay accountValueHistory', async () => {
    const fake = fakeStream()
    const reader = createHyperliquidPortfolioReader(
      fake.stream,
      emptyAllDexsStream(),
      buildFakePullService(),
      buildFakeGateway({ getPortfolio: () => okAsync(PORTFOLIO) }),
      () => ADDR,
      buildFakeLogger().logger,
    )
    const result = await reader.getHistory('accountValue', '24H', 'perps')
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value[0].value).toBe(150)
  })

  it('perpsPnl 24H all → perpDay pnlHistory (perps regardless of scope)', async () => {
    const fake = fakeStream()
    const reader = createHyperliquidPortfolioReader(
      fake.stream,
      emptyAllDexsStream(),
      buildFakePullService(),
      buildFakeGateway({ getPortfolio: () => okAsync(PORTFOLIO) }),
      () => ADDR,
      buildFakeLogger().logger,
    )
    const result = await reader.getHistory('perpsPnl', '24H', 'all')
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value[0].value).toBe(15)
  })

  it('pnl AllTime perps → perpAllTime pnlHistory', async () => {
    const fake = fakeStream()
    const reader = createHyperliquidPortfolioReader(
      fake.stream,
      emptyAllDexsStream(),
      buildFakePullService(),
      buildFakeGateway({ getPortfolio: () => okAsync(PORTFOLIO) }),
      () => ADDR,
      buildFakeLogger().logger,
    )
    const result = await reader.getHistory('pnl', 'AllTime', 'perps')
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value[0].value).toBe(22)
  })

  it('points are PortfolioPoint objects with numeric timestamp and value', async () => {
    const fake = fakeStream()
    const reader = createHyperliquidPortfolioReader(
      fake.stream,
      emptyAllDexsStream(),
      buildFakePullService(),
      buildFakeGateway({ getPortfolio: () => okAsync(PORTFOLIO) }),
      () => ADDR,
      buildFakeLogger().logger,
    )
    const result = await reader.getHistory('accountValue', '24H', 'all')
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    for (const p of result.value) {
      expect(typeof p.timestamp).toBe('number')
      expect(typeof p.value).toBe('number')
    }
  })

  it('gateway error → PortfolioHistoryError', async () => {
    const fake = fakeStream()
    const reader = createHyperliquidPortfolioReader(
      fake.stream,
      emptyAllDexsStream(),
      buildFakePullService(),
      buildFakeGateway(),
      () => ADDR,
      buildFakeLogger().logger,
    )
    const result = await reader.getHistory('accountValue', '24H', 'all')
    expect(result.isErr()).toBe(true)
  })
})

describe('projectMarginSummary (ADR-0072)', () => {
  it('segregated: derives leverage = (a)/(b), ratio = maintenance/(b), sums uPnL', () => {
    const state = buildWebData2({
      crossAccountValue: '8.85',
      crossNtlPos: '300.07',
      crossMaintenanceMarginUsed: '3.75',
      unrealizedPnls: ['0.20', '0.09'],
    })
    const pull = buildFakePullService() // default abstractionMode → segregated

    const summary = projectMarginSummary(state, pull.current(), null)

    expect(summary.crossAccountValueUsd).toBe(8.85)
    expect(summary.totalCrossPositionsValueUsd).toBe(300.07)
    expect(summary.maintenanceMarginUsd).toBe(3.75)
    expect(summary.unrealizedPnlUsd).toBeCloseTo(0.29, 5)
    expect(summary.accountLeverage).toBeCloseTo(300.07 / 8.85, 5)
    expect(summary.marginRatioPct).toBeCloseTo((3.75 / 8.85) * 100, 5)
  })

  it('segregated with zero equity: leverage null, ratio 0 (no divide-by-zero)', () => {
    const state = buildWebData2({ crossAccountValue: '0', crossNtlPos: '0', crossMaintenanceMarginUsed: '0' })
    const summary = projectMarginSummary(state, buildFakePullService().current(), null)
    expect(summary.accountLeverage).toBeNull()
    expect(summary.marginRatioPct).toBe(0)
  })

  it('unified: maintenance/leverage null + marginRatioPct 0, but uPnL IS summed from all dexes', () => {
    const state = buildWebData2({
      crossAccountValue: '8.85',
      crossNtlPos: '300.07',
      crossMaintenanceMarginUsed: '3.75',
    })
    const pull = buildFakePullService({ abstractionMode: 'unifiedAccount' })
    // The open position lives on a HIP-3 dex (uPnL 0.21), invisible to webData2.
    const allDexs = buildAllDexsEvent([
      { dex: '', accountValue: '0' },
      { dex: 'xyz', accountValue: '3.23', unrealizedPnls: ['0.21'] },
    ])

    const summary = projectMarginSummary(state, pull.current(), allDexs)

    expect(summary.maintenanceMarginUsd).toBeNull()
    expect(summary.accountLeverage).toBeNull()
    expect(summary.totalCrossPositionsValueUsd).toBeNull()
    expect(summary.crossAccountValueUsd).toBeNull()
    expect(summary.marginRatioPct).toBe(0)
    // Bug fix: unified uPnL is no longer suppressed — sourced from the HIP-3 dex.
    expect(summary.unrealizedPnlUsd).toBeCloseTo(0.21, 5)
  })
})
