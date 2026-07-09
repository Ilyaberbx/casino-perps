import { describe, it, expect } from 'vitest'
import type { PerpPositionSnapshot, Unsubscribe } from '@/modules/shared/domain'
import { createHyperliquidPerpsPositionsSnapshotReader } from '../perps-positions-snapshot-reader'
import type { AllDexsClearinghouseStateStream } from '../all-dexs-clearinghouse-state-stream'
import type { AllDexsClearinghouseStateEvent } from '../../gateway/sdk-types'
import { buildFakeLogger } from '../__fixtures__/web-data2'
import {
  buildAllDexsClearinghouseStateEvent,
  buildAssetPosition,
  buildClearinghouseState,
} from '../__fixtures__/all-dexs-clearinghouse-state'

interface FakeStream {
  stream: AllDexsClearinghouseStateStream
  emit(event: AllDexsClearinghouseStateEvent): void
}

function fakeStream(): FakeStream {
  let listener: ((s: AllDexsClearinghouseStateEvent) => void) | null = null
  const stream: AllDexsClearinghouseStateStream = {
    current: () => null,
    subscribe(onUpdate): Unsubscribe {
      listener = onUpdate
      return () => {
        listener = null
      }
    },
    connectionStatus: {
      status: () => 'disconnected',
      subscribe: () => () => {},
    },
    refreshAddress: () => {},
    stop: () => {},
  }
  return {
    stream,
    emit(event) {
      if (listener === null) throw new Error('reader not yet subscribed')
      listener(event)
    },
  }
}

describe('createHyperliquidPerpsPositionsSnapshotReader', () => {
  it('projects positions from BOTH the main dex and a HIP-3 dex in one event', () => {
    const fake = fakeStream()
    const reader = createHyperliquidPerpsPositionsSnapshotReader(
      fake.stream,
      buildFakeLogger().logger,
    )
    let latest: ReadonlyArray<PerpPositionSnapshot> = []
    reader.subscribe((positions) => {
      latest = positions
    })

    const mainBtc = buildAssetPosition({
      coin: 'BTC',
      szi: '0.5',
      entryPx: '60000',
      positionValue: '31000',
      unrealizedPnl: '1000',
      returnOnEquity: '0.05',
      leverageType: 'cross',
      leverageValue: 10,
      liquidationPx: '50000',
      marginUsed: '3100',
    })
    // HIP-3 position: dex 'xyz', coin 'xyz:NVDA', szi 0.146, positionValue set
    // so derived markPrice = 175.2 / 0.146 = 1200.
    const hip3Nvda = buildAssetPosition({
      coin: 'xyz:NVDA',
      szi: '0.146',
      entryPx: '1100',
      positionValue: '175.2',
      unrealizedPnl: '14.6',
      returnOnEquity: '0.1',
      leverageType: 'isolated',
      leverageValue: 5,
      liquidationPx: null,
      marginUsed: '35.04',
    })

    fake.emit(
      buildAllDexsClearinghouseStateEvent({
        clearinghouseStates: [
          ['', buildClearinghouseState([mainBtc])],
          ['xyz', buildClearinghouseState([hip3Nvda])],
        ],
      }),
    )

    expect(latest).toHaveLength(2)

    const btc = latest.find((p) => p.symbol === 'BTC')
    expect(btc).toBeDefined()
    expect(btc?.side).toBe('long')
    expect(btc?.size).toBe(0.5)
    expect(btc?.entryPrice).toBe(60000)
    expect(btc?.markPrice).toBe(62000) // 31000 / 0.5
    expect(btc?.positionValueUsd).toBe(31000)
    expect(btc?.unrealizedPnlUsd).toBe(1000)
    expect(btc?.roePct).toBeCloseTo(5)
    expect(btc?.leverage).toBe(10)
    expect(btc?.leverageType).toBe('cross')
    expect(btc?.liquidationPrice).toBe(50000)
    expect(btc?.marginUsedUsd).toBe(3100)

    const nvda = latest.find((p) => p.symbol === 'xyz:NVDA')
    expect(nvda).toBeDefined()
    // Symbol stays RAW — no badge, no split.
    expect(nvda?.symbol).toBe('xyz:NVDA')
    expect(nvda?.size).toBeCloseTo(0.146)
    expect(nvda?.markPrice).toBeCloseTo(1200) // 175.2 / 0.146
    expect(nvda?.leverageType).toBe('isolated')
    expect(nvda?.liquidationPrice).toBeNull()
  })

  it('skips szi === 0 positions but keeps real ones across dexs', () => {
    const fake = fakeStream()
    const reader = createHyperliquidPerpsPositionsSnapshotReader(
      fake.stream,
      buildFakeLogger().logger,
    )
    let latest: ReadonlyArray<PerpPositionSnapshot> = []
    reader.subscribe((positions) => {
      latest = positions
    })

    fake.emit(
      buildAllDexsClearinghouseStateEvent({
        clearinghouseStates: [
          ['', buildClearinghouseState([buildAssetPosition({ coin: 'ETH', szi: '0' })])],
          [
            'flx',
            buildClearinghouseState([
              buildAssetPosition({ coin: 'flx:AAPL', szi: '-2', positionValue: '400' }),
            ]),
          ],
        ],
      }),
    )

    expect(latest).toHaveLength(1)
    expect(latest[0].symbol).toBe('flx:AAPL')
    expect(latest[0].side).toBe('short')
    expect(latest[0].size).toBe(2)
    expect(latest[0].markPrice).toBe(200) // 400 / 2
  })

  it('emits an empty array when no dex carries a position', () => {
    const fake = fakeStream()
    const reader = createHyperliquidPerpsPositionsSnapshotReader(
      fake.stream,
      buildFakeLogger().logger,
    )
    let latest: ReadonlyArray<PerpPositionSnapshot> | null = null
    reader.subscribe((positions) => {
      latest = positions
    })

    fake.emit(buildAllDexsClearinghouseStateEvent({ clearinghouseStates: [] }))

    expect(latest).toEqual([])
  })
})
