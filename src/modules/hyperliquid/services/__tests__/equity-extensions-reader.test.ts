import { describe, it, expect } from 'vitest'
import type { EquityExtensionBucket } from '@/modules/shared/domain'
import { createHyperliquidEquityExtensionsReader } from '../equity-extensions-reader'
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

describe('createHyperliquidEquityExtensionsReader', () => {
  it('emits three buckets (vault, earn, staking) with keys and labels', () => {
    const fake = fakeStream()
    const reader = createHyperliquidEquityExtensionsReader(fake.stream, buildFakePullService(), buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<EquityExtensionBucket>> = []
    reader.subscribe('all', (buckets) => seen.push(buckets))
    fake.emit(buildWebData2({ totalVaultEquity: '1234.5' }))
    const buckets = seen[seen.length - 1]
    expect(buckets.find((b) => b.key === 'vault')?.label).toBe('Vault Equity')
    expect(buckets.find((b) => b.key === 'earn')?.label).toBe('Earn Balance')
    expect(buckets.find((b) => b.key === 'staking')?.label).toBe('Staking Account')
    expect(buckets.find((b) => b.key === 'vault')?.amountUsd).toBeCloseTo(1234.5, 2)
  })

  it('staking bucket = stakingHype × HYPE perp markPx', () => {
    const fake = fakeStream()
    const pull = buildFakePullService({ stakingHype: 100 })
    const reader = createHyperliquidEquityExtensionsReader(fake.stream, pull, buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<EquityExtensionBucket>> = []
    reader.subscribe('all', (b) => seen.push(b))
    const state = buildWebData2()
    const stateWithHype: WebData2Response = {
      ...state,
      meta: { universe: [{ name: 'HYPE' } as never], marginTables: [], collateralToken: 0 },
      assetCtxs: [{ markPx: '15.5' } as never],
    }
    fake.emit(stateWithHype)
    const staking = seen[seen.length - 1].find((b) => b.key === 'staking')
    expect(staking?.amountUsd).toBeCloseTo(1_550, 2)
  })

  it('earn bucket = sum of (supply × spotPrice) across tokens', () => {
    const fake = fakeStream()
    const pull = buildFakePullService({
      earnSupplyByToken: new Map([['1', 50], ['2', 0.5]]),
      spotTokenSymbolByIndex: new Map([[1, 'USDC'], [2, 'ETH']]),
      spotPrices: new Map([['USDC', 1], ['ETH', 2_000]]),
    })
    const reader = createHyperliquidEquityExtensionsReader(fake.stream, pull, buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<EquityExtensionBucket>> = []
    reader.subscribe('all', (b) => seen.push(b))
    fake.emit(buildWebData2())
    const earn = seen[seen.length - 1].find((b) => b.key === 'earn')
    // 50 * 1 + 0.5 * 2000 = 1050
    expect(earn?.amountUsd).toBeCloseTo(1_050, 2)
  })

  it('scope=perps: returns empty array', () => {
    const fake = fakeStream()
    const reader = createHyperliquidEquityExtensionsReader(fake.stream, buildFakePullService(), buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<EquityExtensionBucket>> = []
    reader.subscribe('perps', (buckets) => seen.push(buckets))
    fake.emit(buildWebData2({ totalVaultEquity: '1000' }))
    expect(seen[seen.length - 1]).toHaveLength(0)
  })

  it('updates when vault equity changes', () => {
    const fake = fakeStream()
    const reader = createHyperliquidEquityExtensionsReader(fake.stream, buildFakePullService(), buildFakeLogger().logger)
    const vaultAmounts: number[] = []
    reader.subscribe('all', (buckets) => {
      const vault = buckets.find((b) => b.key === 'vault')
      if (vault) vaultAmounts.push(vault.amountUsd)
    })
    fake.emit(buildWebData2({ totalVaultEquity: '100' }))
    fake.emit(buildWebData2({ totalVaultEquity: '200' }))
    expect(vaultAmounts).toEqual([100, 200])
  })

  it('does not emit when stream has no current state', () => {
    const fake = fakeStream()
    const reader = createHyperliquidEquityExtensionsReader(fake.stream, buildFakePullService(), buildFakeLogger().logger)
    const seen: unknown[] = []
    reader.subscribe('all', (b) => seen.push(b))
    expect(seen).toHaveLength(0)
  })

  it('emits a debug projection record per update with module + scope + count', () => {
    const fake = fakeStream()
    const fakeLogger = buildFakeLogger()
    const reader = createHyperliquidEquityExtensionsReader(fake.stream, buildFakePullService(), fakeLogger.logger)
    reader.subscribe('all', () => {})
    fake.emit(buildWebData2({ totalVaultEquity: '1' }))
    const projections = fakeLogger.records.filter(
      (r) => r.level === 'debug' && r.message === 'projection',
    )
    expect(projections.length).toBeGreaterThanOrEqual(1)
    expect(projections[0].fields.module).toBe('hyperliquid-equity-reader')
    expect(projections[0].fields).toHaveProperty('scope', 'all')
    expect(projections[0].fields).toHaveProperty('count')
  })
})
