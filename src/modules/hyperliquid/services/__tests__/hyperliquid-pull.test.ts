import { describe, it, expect } from 'vitest'
import { errAsync, okAsync } from 'neverthrow'
import type { WalletAddress } from '@/modules/shared/domain'
import { createHyperliquidPullService } from '../hyperliquid-pull'
import { HyperliquidGatewayError } from '../../gateway'
import type { AllPerpMetasResponse, PortfolioResponse } from '../../gateway/sdk-types'
import { buildFakeGateway, buildFakeLogger, buildUserFees } from '../__fixtures__/web-data2'

const ADDR = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as WalletAddress

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('createHyperliquidPullService — logging', () => {
  it('emits structured warn { module, source, kind, errorMessage } when a gateway source errors', async () => {
    const fakeLogger = buildFakeLogger()
    const gateway = buildFakeGateway({
      getPortfolio: () => errAsync(new HyperliquidGatewayError('network', 'boom')),
    })
    const pull = createHyperliquidPullService({
      gateway,
      getAddress: () => ADDR,
      logger: fakeLogger.logger,
      setTimer: () => 1,
      clearTimer: () => {},
    })
    pull.subscribe(() => {})
    await flushMicrotasks()
    const warns = fakeLogger.records.filter(
      (r) => r.level === 'warn' && r.message === 'pull failed',
    )
    expect(warns.length).toBeGreaterThanOrEqual(1)
    const portfolioWarn = warns.find((w) => w.fields.source === 'portfolio')
    expect(portfolioWarn).toBeDefined()
    expect(portfolioWarn?.fields.module).toBe('hyperliquid-pull')
    expect(portfolioWarn?.fields.kind).toBe('network')
    expect(portfolioWarn?.fields.errorMessage).toBe('boom')
    pull.stop()
  })

  it('emits an info start record with formatted address and a debug tick', async () => {
    const fakeLogger = buildFakeLogger()
    const pull = createHyperliquidPullService({
      gateway: buildFakeGateway(),
      getAddress: () => ADDR,
      logger: fakeLogger.logger,
      setTimer: () => 1,
      clearTimer: () => {},
    })
    pull.subscribe(() => {})
    await flushMicrotasks()
    const startRecord = fakeLogger.records.find(
      (r) => r.level === 'info' && r.message === 'start',
    )
    expect(startRecord).toBeDefined()
    expect(startRecord?.fields.module).toBe('hyperliquid-pull')
    expect(String(startRecord?.fields.address)).toMatch(/^0x…/)
    expect(String(startRecord?.fields.address)).not.toContain('aaaaaaaaaa')
    const tickRecord = fakeLogger.records.find(
      (r) => r.level === 'debug' && r.message === 'tick',
    )
    expect(tickRecord).toBeDefined()
    pull.stop()
  })
})

describe('createHyperliquidPullService — userFees snapshot', () => {
  it('surfaces the raw getUserFees payload on the snapshot for the readers to project', async () => {
    const payload = buildUserFees({ userCrossRate: '0.00045' })
    const pull = createHyperliquidPullService({
      gateway: buildFakeGateway({ getUserFees: () => okAsync(payload) }),
      getAddress: () => ADDR,
      logger: buildFakeLogger().logger,
      setTimer: () => 1,
      clearTimer: () => {},
    })
    expect(pull.current().userFees).toBeNull()
    pull.subscribe(() => {})
    await flushMicrotasks()
    expect(pull.current().userFees).toBe(payload)
    pull.stop()
  })
})

describe('createHyperliquidPullService — window-keyed portfolio (ADR-0039)', () => {
  // Distinct vlm + last-pnl per bucket so per-period extraction is provable.
  // Values mirror the live debug-address shape (day vlm 334.95 / pnl −0.357 vs
  // allTime vlm 2583.48 / pnl +0.381) plus a separate perp* family.
  const PORTFOLIO: PortfolioResponse = [
    ['day', { accountValueHistory: [], pnlHistory: [[1, '-0.357']], vlm: '334.95' }],
    ['week', { accountValueHistory: [], pnlHistory: [[2, '-0.887']], vlm: '2571.67' }],
    ['month', { accountValueHistory: [], pnlHistory: [[3, '-0.575']], vlm: '2571.68' }],
    ['allTime', { accountValueHistory: [], pnlHistory: [[4, '0.381']], vlm: '2583.48' }],
    ['perpDay', { accountValueHistory: [], pnlHistory: [[5, '-0.4']], vlm: '300.0' }],
    ['perpWeek', { accountValueHistory: [], pnlHistory: [[6, '-0.9']], vlm: '2552.02' }],
    ['perpMonth', { accountValueHistory: [], pnlHistory: [[7, '-0.6']], vlm: '2552.03' }],
    ['perpAllTime', { accountValueHistory: [], pnlHistory: [[8, '0.5']], vlm: '2560.0' }],
  ] as unknown as PortfolioResponse

  it('caches both bucket families with per-window pnl + volume from one response', async () => {
    const pull = createHyperliquidPullService({
      gateway: buildFakeGateway({ getPortfolio: () => okAsync(PORTFOLIO) }),
      getAddress: () => ADDR,
      logger: buildFakeLogger().logger,
      setTimer: () => 1,
      clearTimer: () => {},
    })
    pull.subscribe(() => {})
    await flushMicrotasks()
    const snap = pull.current()
    expect(snap.portfolioCombined.pnl).toEqual({
      '24H': -0.357,
      '7D': -0.887,
      '30D': -0.575,
      AllTime: 0.381,
    })
    expect(snap.portfolioCombined.volume).toEqual({
      '24H': 334.95,
      '7D': 2_571.67,
      '30D': 2_571.68,
      AllTime: 2_583.48,
    })
    // Perp family is distinct from combined (perpWeek vlm ≠ week vlm).
    expect(snap.portfolioPerps.pnl.AllTime).toBe(0.5)
    expect(snap.portfolioPerps.volume['7D']).toBe(2_552.02)
    expect(snap.portfolioPerps.volume['7D']).not.toBe(snap.portfolioCombined.volume['7D'])
    pull.stop()
  })
})

describe('createHyperliquidPullService — unified collateral tokens', () => {
  it('unions every perp dex collateralToken (plus USDC) from getAllPerpMetas', async () => {
    // Default dex collateral USDC=0; HIP-3 builder dexes add stablecoins
    // (USDH=360, USDE=235). Wire shape carries fields irrelevant here; cast.
    const metas = [
      { collateralToken: 0, universe: [], marginTables: [] },
      { collateralToken: 360, universe: [], marginTables: [] },
      { collateralToken: 235, universe: [], marginTables: [] },
    ] as unknown as AllPerpMetasResponse
    const pull = createHyperliquidPullService({
      gateway: buildFakeGateway({ getAllPerpMetas: () => okAsync(metas) }),
      getAddress: () => ADDR,
      logger: buildFakeLogger().logger,
      setTimer: () => 1,
      clearTimer: () => {},
    })
    // Default before any pull resolves: USDC index only.
    expect([...pull.current().unifiedCollateralTokenIndices]).toEqual([0])
    pull.subscribe(() => {})
    await flushMicrotasks()
    expect([...pull.current().unifiedCollateralTokenIndices].sort((a, b) => a - b)).toEqual([
      0, 235, 360,
    ])
    pull.stop()
  })
})
