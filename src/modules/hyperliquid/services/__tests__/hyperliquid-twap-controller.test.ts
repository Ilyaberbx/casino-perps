import { describe, it, expect } from 'vitest'
import { errAsync, okAsync } from 'neverthrow'
import type { ActiveTwap } from '@/modules/shared/domain'
import { HyperliquidGatewayError } from '../../gateway'
import type { HyperliquidExchangeGateway, TwapCancelParameters } from '../../gateway'
import type { HyperliquidAssetInfo } from '../hyperliquid-trader.types'
import { createHyperliquidTwapController } from '../hyperliquid-twap-controller'
import { buildFakeLogger } from '../__fixtures__/web-data2'

const ASSET: HyperliquidAssetInfo = { assetId: 4, szDecimals: 3, marketType: 'perp' }

function makeTwap(overrides: Partial<ActiveTwap> = {}): ActiveTwap {
  return {
    identifier: '99',
    symbol: 'BTC-PERP',
    side: 'buy',
    size: 1,
    executedSize: 0.5,
    executedNotionalUsd: 50_000,
    durationMinutes: 30,
    reduceOnly: false,
    randomize: false,
    createdAt: 1_700_000_000_000,
    ...overrides,
  }
}

interface FakeGatewayOptions {
  readonly cancelTwap?: HyperliquidExchangeGateway['cancelTwap']
  readonly resolveAsset?: (symbol: string) => HyperliquidAssetInfo | null
  readonly agentWallet?: object | null
}

function buildController(options: FakeGatewayOptions = {}) {
  const calls: TwapCancelParameters[] = []
  const cancelTwap: HyperliquidExchangeGateway['cancelTwap'] =
    options.cancelTwap ??
    ((_wallet, params) => {
      calls.push(params)
      return okAsync({
        status: 'ok',
        response: { type: 'twapCancel', data: { status: 'success' } },
      } as never)
    })
  const exchangeGateway = { cancelTwap } as unknown as HyperliquidExchangeGateway
  const controller = createHyperliquidTwapController({
    exchangeGateway,
    getAgentWallet: () => (options.agentWallet === undefined ? ({} as never) : (options.agentWallet as never)),
    resolveAsset: options.resolveAsset ?? (() => ASSET),
    logger: buildFakeLogger().logger,
  })
  return { controller, calls }
}

describe('createHyperliquidTwapController', () => {
  describe('cancelTwap', () => {
    it('resolves the asset id and twapId, then calls the gateway with { a, t }', async () => {
      const { controller, calls } = buildController()
      const result = await controller.cancelTwap(makeTwap({ identifier: '77', symbol: 'BTC-PERP' }))
      expect(result.isOk()).toBe(true)
      expect(calls).toHaveLength(1)
      expect(calls[0]).toEqual({ a: 4, t: 77 })
    })

    it('returns unknown-symbol when the asset cannot be resolved', async () => {
      const { controller, calls } = buildController({ resolveAsset: () => null })
      const result = await controller.cancelTwap(makeTwap({ symbol: 'NOPE' }))
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('unknown-symbol')
      expect(calls).toHaveLength(0)
    })

    it('returns rejected when no agent wallet is available', async () => {
      const { controller, calls } = buildController({ agentWallet: null })
      const result = await controller.cancelTwap(makeTwap())
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('rejected')
      expect(calls).toHaveLength(0)
    })

    it('surfaces a gateway error as a rejected CancelTwapError', async () => {
      const { controller } = buildController({
        cancelTwap: () => errAsync(new HyperliquidGatewayError('network', 'boom')),
      })
      const result = await controller.cancelTwap(makeTwap())
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.kind).toBe('rejected')
        expect(result.error.message).toContain('boom')
      }
    })

    it('surfaces a status:ok-with-error envelope as a rejected CancelTwapError', async () => {
      const { controller } = buildController({
        cancelTwap: () =>
          okAsync({
            status: 'ok',
            response: { type: 'twapCancel', data: { status: { error: 'TWAP not found' } } },
          } as never),
      })
      const result = await controller.cancelTwap(makeTwap())
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.kind).toBe('rejected')
        expect(result.error.message).toContain('TWAP not found')
      }
    })
  })

  describe('cancelAll', () => {
    it('cancels every twap and resolves to an empty error list when all succeed', async () => {
      const { controller, calls } = buildController()
      const twaps = [makeTwap({ identifier: '1' }), makeTwap({ identifier: '2' })]
      const result = await controller.cancelAll(twaps)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toHaveLength(0)
      expect(calls.map((c) => c.t)).toEqual([1, 2])
    })

    it('collects failures without short-circuiting', async () => {
      let n = 0
      const { controller } = buildController({
        cancelTwap: (_wallet, params) => {
          n += 1
          if (params.t === 2) return errAsync(new HyperliquidGatewayError('network', 'fail-2'))
          return okAsync({
            status: 'ok',
            response: { type: 'twapCancel', data: { status: 'success' } },
          } as never)
        },
      })
      const twaps = [makeTwap({ identifier: '1' }), makeTwap({ identifier: '2' }), makeTwap({ identifier: '3' })]
      const result = await controller.cancelAll(twaps)
      expect(n).toBe(3)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0]?.message).toContain('fail-2')
      }
    })
  })
})
