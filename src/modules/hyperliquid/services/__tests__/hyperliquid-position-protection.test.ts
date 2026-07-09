import { describe, it, expect } from 'vitest'
import { ok, okAsync } from 'neverthrow'
import { SetPositionProtectionError } from '@/modules/shared/domain'
import { buildFakeExchangeGateway } from '../../gateway/__fixtures__/fake-exchange-gateway'
import type { HyperliquidAgentWallet, OrderParameters } from '../../gateway'
import { buildFakeLogger } from '../__fixtures__/web-data2'
import { createHyperliquidPositionProtection, type HyperliquidPositionState } from '../hyperliquid-position-protection'
import type { HyperliquidAssetInfo, HyperliquidOrderRef } from '../hyperliquid-trader.types'

const FAKE_AGENT_WALLET = { __fake: true } as unknown as HyperliquidAgentWallet
const BTC_ASSET: HyperliquidAssetInfo = { assetId: 0, szDecimals: 5, marketType: 'perp' }
const LONG_POSITION: HyperliquidPositionState = { side: 'buy', size: 2, referencePrice: 60_000 }

interface Harness {
  getAgentWallet?: () => HyperliquidAgentWallet | null
  resolveAsset?: (symbol: string) => HyperliquidAssetInfo | null
  getPositionState?: (symbol: string) => HyperliquidPositionState | null
  getProtectionOrderRefs?: (symbol: string) => ReadonlyArray<HyperliquidOrderRef>
}

function build(harness: Harness = {}) {
  const captured: { orders: OrderParameters[]; cancels: Array<string | number> } = {
    orders: [],
    cancels: [],
  }
  const gateway = buildFakeExchangeGateway({
    placeOrder: (_wallet, params) => {
      captured.orders.push(params)
      return okAsync({ status: 'ok', response: { type: 'order', data: { statuses: [] } } } as never)
    },
    cancelOrder: (_wallet, params) => {
      params.cancels.forEach((cancel) => captured.cancels.push(cancel.o))
      return okAsync({ status: 'ok', response: { type: 'cancel', data: { statuses: ['success'] } } } as never)
    },
    formatPrice: (price) => ok(String(price)),
    formatSize: (size) => ok(String(size)),
  })
  const protection = createHyperliquidPositionProtection({
    exchangeGateway: gateway,
    getAgentWallet: harness.getAgentWallet ?? (() => FAKE_AGENT_WALLET),
    resolveAsset: harness.resolveAsset ?? (() => BTC_ASSET),
    getPositionState: harness.getPositionState ?? (() => LONG_POSITION),
    getProtectionOrderRefs: harness.getProtectionOrderRefs ?? (() => []),
    logger: buildFakeLogger().logger,
    builder: { address: '0xbuilder', feeTenthsOfBps: 10 },
  })
  return { protection, captured }
}

describe('createHyperliquidPositionProtection.setProtection', () => {
  it('places a positionTpsl-grouped opposite-side reduce-only trigger for a TP leg', async () => {
    const { protection, captured } = build()
    const result = await protection.setProtection('BTC-PERP', {
      takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 70_000 } },
    })
    expect(result.isOk()).toBe(true)
    expect(captured.orders).toHaveLength(1)
    const params = captured.orders[0]
    expect(params.grouping).toBe('positionTpsl')
    expect(params.orders[0]).toMatchObject({ b: false, r: true, t: { trigger: { tpsl: 'tp' } } })
  })

  it('defaults the order size to the full position size when leg.size is absent', async () => {
    const { protection, captured } = build()
    await protection.setProtection('BTC-PERP', {
      takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 70_000 } },
    })
    // fake formatSize echoes the number → full abs position size (2).
    expect(captured.orders[0].orders[0]).toMatchObject({ s: '2' })
  })

  it('maps leg.size to a partial order size when present', async () => {
    const { protection, captured } = build()
    await protection.setProtection('BTC-PERP', {
      takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 70_000 }, size: 0.5 },
    })
    expect(captured.orders[0].orders[0]).toMatchObject({ s: '0.5' })
  })

  it('places a trigger-market leg (isMarket true, limitPx = triggerPx) when limitPrice is absent', async () => {
    const { protection, captured } = build()
    await protection.setProtection('BTC-PERP', {
      takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 70_000 } },
    })
    expect(captured.orders[0].orders[0]).toMatchObject({
      p: '70000',
      t: { trigger: { isMarket: true, triggerPx: '70000' } },
    })
  })

  it('places a trigger-limit leg (isMarket false, limitPx = leg.limitPrice) when limitPrice is present', async () => {
    const { protection, captured } = build()
    await protection.setProtection('BTC-PERP', {
      takeProfit: {
        kind: 'take-profit',
        trigger: { type: 'price', price: 70_000 },
        limitPrice: 69_500,
      },
    })
    expect(captured.orders[0].orders[0]).toMatchObject({
      p: '69500',
      t: { trigger: { isMarket: false, triggerPx: '70000' } },
    })
  })

  it('cancels resting protection orders before placing the new legs (replace)', async () => {
    const existing: HyperliquidOrderRef = {
      assetId: 0,
      oid: 42,
      symbol: 'BTC-PERP',
      side: 'sell',
      price: 70_000,
      size: 2,
      reduceOnly: true,
    }
    const { protection, captured } = build({ getProtectionOrderRefs: () => [existing] })
    await protection.setProtection('BTC-PERP', {
      stopLoss: { kind: 'stop-loss', trigger: { type: 'price', price: 55_000 } },
    })
    expect(captured.cancels).toEqual([42])
    expect(captured.orders).toHaveLength(1)
  })

  it('rejects no-position before signing', async () => {
    const { protection, captured } = build({ getPositionState: () => null })
    const result = await protection.setProtection('BTC-PERP', {
      takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 70_000 } },
    })
    expect(result.isErr()).toBe(true)
    result.match(
      () => expect.fail('expected error'),
      (e) => expect((e as SetPositionProtectionError).kind).toBe('no-position'),
    )
    expect(captured.orders).toHaveLength(0)
  })

  it('rejects an unknown symbol', async () => {
    const { protection } = build({ resolveAsset: () => null })
    const result = await protection.setProtection('NOPE', {
      takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 1 } },
    })
    expect(result.isErr()).toBe(true)
  })

  it('returns a typed rejected error when no signing wallet is available', async () => {
    const { protection, captured } = build({ getAgentWallet: () => null })
    const result = await protection.setProtection('BTC-PERP', {
      takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 70_000 } },
    })
    expect(result.isErr()).toBe(true)
    result.match(
      () => expect.fail('expected error'),
      (e) => expect((e as SetPositionProtectionError).kind).toBe('rejected'),
    )
    expect(captured.orders).toHaveLength(0)
  })
})

describe('createHyperliquidPositionProtection.clearProtection', () => {
  it('cancels the resting protection orders for the symbol', async () => {
    const existing: HyperliquidOrderRef = {
      assetId: 0,
      oid: 7,
      symbol: 'BTC-PERP',
      side: 'sell',
      price: 70_000,
      size: 2,
      reduceOnly: true,
    }
    const { protection, captured } = build({ getProtectionOrderRefs: () => [existing] })
    const result = await protection.clearProtection('BTC-PERP')
    expect(result.isOk()).toBe(true)
    expect(captured.cancels).toEqual([7])
  })

  it('is a no-op ok when there are no resting protection orders', async () => {
    const { protection, captured } = build()
    const result = await protection.clearProtection('BTC-PERP')
    expect(result.isOk()).toBe(true)
    expect(captured.cancels).toEqual([])
  })
})
