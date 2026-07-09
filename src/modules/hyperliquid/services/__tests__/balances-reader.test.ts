import { describe, it, expect } from 'vitest'
import type { Balance } from '@/modules/shared/domain'
import { createHyperliquidBalancesReader } from '../balances-reader'
import type { WebData2Stream } from '../web-data2-stream'
import type { WebData2Response } from '../../gateway/sdk-types'
import { buildFakeLogger, buildFakePullService, buildWebData2 } from '../__fixtures__/web-data2'

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
      connectionStatus: {
        status: () => 'connected',
        subscribe: () => () => {},
      },
      refreshAddress: () => {},
      stop: () => {},
    },
    emit(s) {
      latest = s
      for (const listener of listeners) listener(s)
    },
  }
}

describe('createHyperliquidBalancesReader', () => {
  describe('scope=all', () => {
    it('emits spot balances with amountUsd derived from pull-cache spot prices', () => {
      const fake = fakeStream()
      const pull = buildFakePullService({ spotPrices: new Map([['USDC', 1], ['ETH', 2_000]]) })
      const reader = createHyperliquidBalancesReader(fake.stream, pull, buildFakeLogger().logger)
      const seen: Array<ReadonlyArray<Balance>> = []
      reader.subscribe('all', (b) => seen.push(b))
      fake.emit(
        buildWebData2({
          spotBalances: [
            { coin: 'USDC', total: '500', hold: '0' },
            { coin: 'ETH', total: '1.5', hold: '0.5' },
          ],
        }),
      )
      const balances = seen[seen.length - 1]
      const usdc = balances.find((b) => b.asset === 'USDC')
      const eth = balances.find((b) => b.asset === 'ETH')
      expect(usdc?.amount).toBeCloseTo(500, 2)
      expect(usdc?.available).toBeCloseTo(500, 2)
      expect(usdc?.amountUsd).toBeCloseTo(500, 2)
      expect(usdc?.pnlPct).toBeNull()
      expect(eth?.amount).toBeCloseTo(1.5, 4)
      expect(eth?.available).toBeCloseTo(1.0, 4)
      expect(eth?.amountUsd).toBeCloseTo(3_000, 2)
      expect(eth?.pnlPct).toBeNull()
    })

    it('re-emits updated balances on each state update', () => {
      const fake = fakeStream()
      const reader = createHyperliquidBalancesReader(fake.stream, buildFakePullService(), buildFakeLogger().logger)
      const seen: number[] = []
      reader.subscribe('all', (b) => {
        const usdc = b.find((e) => e.asset === 'USDC')
        if (usdc) seen.push(usdc.amount)
      })
      fake.emit(buildWebData2({ spotBalances: [{ coin: 'USDC', total: '100', hold: '0' }] }))
      fake.emit(buildWebData2({ spotBalances: [{ coin: 'USDC', total: '200', hold: '0' }] }))
      expect(seen).toEqual([100, 200])
    })

    it('returns empty list when no spot balances exist', () => {
      const fake = fakeStream()
      const reader = createHyperliquidBalancesReader(fake.stream, buildFakePullService(), buildFakeLogger().logger)
      const seen: Array<ReadonlyArray<Balance>> = []
      reader.subscribe('all', (b) => seen.push(b))
      fake.emit(buildWebData2({ spotBalances: [] }))
      expect(seen[seen.length - 1]).toHaveLength(0)
    })

    it('unsubscribing stops further callbacks', () => {
      const fake = fakeStream()
      const reader = createHyperliquidBalancesReader(fake.stream, buildFakePullService(), buildFakeLogger().logger)
      const seen: number[] = []
      const unsub = reader.subscribe('all', (b) => seen.push(b.length))
      fake.emit(buildWebData2())
      const before = seen.length
      unsub()
      fake.emit(buildWebData2())
      expect(seen.length).toBe(before)
    })
  })

  describe('scope=perps', () => {
    it('emits a USDC row with Total = accountValue (equity) and Available = withdrawable', () => {
      const fake = fakeStream()
      const reader = createHyperliquidBalancesReader(fake.stream, buildFakePullService(), buildFakeLogger().logger)
      const seen: Array<ReadonlyArray<Balance>> = []
      reader.subscribe('perps', (b) => seen.push(b))
      // accountValue (1050) deliberately differs from totalRawUsd (1000): an
      // open position carries +50 unrealized PnL, so equity > raw USD. The row
      // must report equity, not raw USD, and Available must be `withdrawable`
      // (750) — not the old `totalRawUsd - totalMarginUsed` (700) derivation.
      const state = buildWebData2({ totalRawUsd: '1000', accountValue: '1050' })
      const stateWithMargin: WebData2Response = {
        ...state,
        clearinghouseState: {
          ...state.clearinghouseState,
          withdrawable: '750',
          marginSummary: { ...state.clearinghouseState.marginSummary, totalMarginUsed: '300' },
          assetPositions: [
            { type: 'oneWay', position: { unrealizedPnl: '50' } as never } as never,
          ],
        },
      }
      fake.emit(stateWithMargin)
      const row = seen[seen.length - 1].find((b) => b.asset === 'USDC')
      expect(row).toBeDefined()
      expect(row?.amount).toBeCloseTo(1_050, 2)
      expect(row?.available).toBeCloseTo(750, 2)
      expect(row?.amountUsd).toBeCloseTo(1_050, 2)
      // pnlPct = unrealized (50) / accountValue (1050) * 100
      expect(row?.pnlPct).toBeCloseTo(4.7619, 3)
    })
  })

  describe('unified / portfolio-margin account', () => {
    it('scope=all → collateral assets tagged unified, non-collateral assets tagged spot', () => {
      const fake = fakeStream()
      // Unified accounts report all balances + holds in the spot clearinghouse
      // state; the perp marginSummary is ~0 even when funded. Source is per-row:
      // only collateral tokens (USDC here) are `unified`; ETH is plain `spot`.
      const pull = buildFakePullService({
        abstractionMode: 'unifiedAccount',
        spotPrices: new Map([['USDC', 1], ['ETH', 2_000]]),
        unifiedCollateralTokenIndices: new Set([0]),
        spotTokenSymbolByIndex: new Map([[0, 'USDC']]),
      })
      const reader = createHyperliquidBalancesReader(fake.stream, pull, buildFakeLogger().logger)
      const seen: Array<ReadonlyArray<Balance>> = []
      reader.subscribe('all', (b) => seen.push(b))
      fake.emit(
        buildWebData2({
          accountValue: '0',
          spotBalances: [
            { coin: 'USDC', total: '1000', hold: '200' },
            { coin: 'ETH', total: '2', hold: '0' },
          ],
        }),
      )
      const balances = seen[seen.length - 1]
      const usdc = balances.find((b) => b.asset === 'USDC')
      const eth = balances.find((b) => b.asset === 'ETH')
      expect(usdc?.source).toBe('unified')
      expect(usdc?.amount).toBeCloseTo(1_000, 2)
      // available = total − hold; holds live in spot for unified accounts.
      expect(usdc?.available).toBeCloseTo(800, 2)
      // ETH is not a collateral token → plain spot even on a unified account.
      expect(eth?.source).toBe('spot')
      expect(eth?.amount).toBeCloseTo(2, 4)
      expect(eth?.amountUsd).toBeCloseTo(4_000, 2)
    })

    it('scope=perps → empty (no phantom ~0 margin-summary row)', () => {
      const fake = fakeStream()
      const pull = buildFakePullService({ abstractionMode: 'unifiedAccount' })
      const reader = createHyperliquidBalancesReader(fake.stream, pull, buildFakeLogger().logger)
      const seen: Array<ReadonlyArray<Balance>> = []
      reader.subscribe('perps', (b) => seen.push(b))
      // marginSummary reports a non-zero accountValue we must NOT surface as a row.
      fake.emit(buildWebData2({ accountValue: '0', spotBalances: [{ coin: 'USDC', total: '1000', hold: '0' }] }))
      expect(seen[seen.length - 1]).toHaveLength(0)
    })

    it('non-USDC collateral (USDH) → unified; Unit asset (UBTC) → canonical BTC + spot + USD', () => {
      const fake = fakeStream()
      // A HIP-3 dex collateralized by USDH (spot token index 360) makes USDH a
      // unified-collateral asset; UBTC is not collateral → plain spot, and its
      // display symbol canonicalizes to BTC with a real USD value from the price.
      const pull = buildFakePullService({
        abstractionMode: 'unifiedAccount',
        spotPrices: new Map([['USDC', 1], ['USDH', 1], ['UBTC', 60_000]]),
        unifiedCollateralTokenIndices: new Set([0, 360]),
        spotTokenSymbolByIndex: new Map([[0, 'USDC'], [360, 'USDH']]),
      })
      const reader = createHyperliquidBalancesReader(fake.stream, pull, buildFakeLogger().logger)
      const seen: Array<ReadonlyArray<Balance>> = []
      reader.subscribe('all', (b) => seen.push(b))
      fake.emit(
        buildWebData2({
          spotBalances: [
            { coin: 'USDH', total: '500', hold: '0' },
            { coin: 'UBTC', total: '0.5', hold: '0' },
          ],
        }),
      )
      const balances = seen[seen.length - 1]
      const usdh = balances.find((b) => b.asset === 'USDH')
      const btc = balances.find((b) => b.asset === 'BTC')
      // Case 1: USDH is collateral → unified; UBTC is not → spot.
      expect(usdh?.source).toBe('unified')
      expect(btc?.source).toBe('spot')
      // Case 3: UBTC display symbol canonicalizes to BTC (no raw 'UBTC' row).
      expect(balances.find((b) => b.asset === 'UBTC')).toBeUndefined()
      // Case 2: USD = size × spot price (join keyed on raw 'UBTC').
      expect(btc?.amountUsd).toBeCloseTo(30_000, 2)
    })

    it('portfolioMargin is also treated as unified for scope=all', () => {
      const fake = fakeStream()
      const pull = buildFakePullService({
        abstractionMode: 'portfolioMargin',
        spotPrices: new Map([['USDC', 1]]),
      })
      const reader = createHyperliquidBalancesReader(fake.stream, pull, buildFakeLogger().logger)
      const seen: Array<ReadonlyArray<Balance>> = []
      reader.subscribe('all', (b) => seen.push(b))
      fake.emit(buildWebData2({ spotBalances: [{ coin: 'USDC', total: '500', hold: '0' }] }))
      expect(seen[seen.length - 1].find((b) => b.asset === 'USDC')?.source).toBe('unified')
    })

    it('classic (default mode) is unchanged: scope=all → spot rows, scope=perps → margin row', () => {
      const fake = fakeStream()
      const pull = buildFakePullService({
        abstractionMode: 'default',
        spotPrices: new Map([['USDC', 1]]),
      })
      const reader = createHyperliquidBalancesReader(fake.stream, pull, buildFakeLogger().logger)
      const allSeen: Array<ReadonlyArray<Balance>> = []
      const perpsSeen: Array<ReadonlyArray<Balance>> = []
      reader.subscribe('all', (b) => allSeen.push(b))
      reader.subscribe('perps', (b) => perpsSeen.push(b))
      fake.emit(buildWebData2({ accountValue: '1000', spotBalances: [{ coin: 'USDC', total: '500', hold: '0' }] }))
      expect(allSeen[allSeen.length - 1].find((b) => b.asset === 'USDC')?.source).toBe('spot')
      const perpsRow = perpsSeen[perpsSeen.length - 1].find((b) => b.asset === 'USDC')
      expect(perpsRow?.source).toBe('perps')
      expect(perpsRow?.amount).toBeCloseTo(1_000, 2)
    })
  })

  describe('logging', () => {
    it('emits a debug projection record per update with module + scope + count', () => {
      const fake = fakeStream()
      const fakeLogger = buildFakeLogger()
      const reader = createHyperliquidBalancesReader(fake.stream, buildFakePullService(), fakeLogger.logger)
      reader.subscribe('all', () => {})
      fake.emit(buildWebData2({ spotBalances: [{ coin: 'USDC', total: '10', hold: '0' }] }))
      const projections = fakeLogger.records.filter(
        (r) => r.level === 'debug' && r.message === 'projection',
      )
      expect(projections.length).toBeGreaterThanOrEqual(1)
      expect(projections[0].fields.module).toBe('hyperliquid-balances-reader')
      expect(projections[0].fields).toHaveProperty('scope', 'all')
      expect(projections[0].fields).toHaveProperty('count')
    })
  })

  describe('wallet-not-connected (no state yet)', () => {
    it('does not emit when stream has no current state', () => {
      const fake = fakeStream()
      const reader = createHyperliquidBalancesReader(fake.stream, buildFakePullService(), buildFakeLogger().logger)
      const seen: unknown[] = []
      reader.subscribe('all', (b) => seen.push(b))
      expect(seen).toHaveLength(0)
    })
  })
})
