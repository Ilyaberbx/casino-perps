import { describe, it, expect } from 'vitest'
import { okAsync } from 'neverthrow'
import { SetLeverageError, SetMarginModeError } from '@/modules/shared/domain'
import { buildFakeExchangeGateway } from '../../gateway/__fixtures__/fake-exchange-gateway'
import type { HyperliquidAgentWallet, UpdateLeverageParameters } from '../../gateway'
import { buildFakeLogger } from '../__fixtures__/web-data2'
import { createHyperliquidLeverageMargin, type HyperliquidLeverageState } from '../hyperliquid-leverage-margin'
import type { HyperliquidAssetInfo } from '../hyperliquid-trader.types'

const FAKE_AGENT_WALLET = { __fake: true } as unknown as HyperliquidAgentWallet
const BTC_ASSET: HyperliquidAssetInfo = { assetId: 0, szDecimals: 5, marketType: 'perp' }

interface Harness {
  readonly getAgentWallet?: () => HyperliquidAgentWallet | null
  readonly resolveAsset?: (symbol: string) => HyperliquidAssetInfo | null
  readonly getCurrentState?: (symbol: string) => HyperliquidLeverageState | null
}

function build(harness: Harness = {}) {
  const captured: { params: UpdateLeverageParameters[] } = { params: [] }
  const gateway = buildFakeExchangeGateway({
    updateLeverage: (_wallet, params) => {
      captured.params.push(params)
      return okAsync({ status: 'ok', response: { type: 'default' } } as never)
    },
  })
  const controllers = createHyperliquidLeverageMargin({
    exchangeGateway: gateway,
    getAgentWallet: harness.getAgentWallet ?? (() => FAKE_AGENT_WALLET),
    resolveAsset: harness.resolveAsset ?? (() => BTC_ASSET),
    getCurrentState: harness.getCurrentState ?? (() => null),
    logger: buildFakeLogger().logger,
  })
  return { ...controllers, captured }
}

describe('createHyperliquidLeverageMargin.leverageController', () => {
  it('sends updateLeverage carrying the current margin mode (isCross)', async () => {
    const { leverageController, captured } = build({
      getCurrentState: () => ({ leverage: 5, isCross: false }),
    })
    const result = await leverageController.setLeverage('BTC-PERP', 20)
    expect(result.isOk()).toBe(true)
    expect(captured.params).toEqual([{ asset: 0, isCross: false, leverage: 20 }])
  })

  it('defaults to cross when no current position state exists', async () => {
    const { leverageController, captured } = build()
    await leverageController.setLeverage('BTC-PERP', 10)
    expect(captured.params[0]).toEqual({ asset: 0, isCross: true, leverage: 10 })
  })

  it('rejects an unknown symbol before signing', async () => {
    const { leverageController, captured } = build({ resolveAsset: () => null })
    const result = await leverageController.setLeverage('NOPE', 10)
    expect(result.isErr()).toBe(true)
    result.match(
      () => expect.fail('expected error'),
      (e) => expect((e as SetLeverageError).kind).toBe('unknown-symbol'),
    )
    expect(captured.params).toHaveLength(0)
  })

  it('rejects a non-integer / sub-1 leverage', async () => {
    const { leverageController } = build()
    expect((await leverageController.setLeverage('BTC-PERP', 0)).isErr()).toBe(true)
    expect((await leverageController.setLeverage('BTC-PERP', 2.5)).isErr()).toBe(true)
  })

  it('returns a typed rejected error (no throw) when no signing wallet is available', async () => {
    const { leverageController, captured } = build({ getAgentWallet: () => null })
    const result = await leverageController.setLeverage('BTC-PERP', 10)
    expect(result.isErr()).toBe(true)
    result.match(
      () => expect.fail('expected error'),
      (e) => expect((e as SetLeverageError).kind).toBe('rejected'),
    )
    expect(captured.params).toHaveLength(0)
  })
})

describe('createHyperliquidLeverageMargin.marginModeController', () => {
  it('sends updateLeverage carrying the current leverage with the new isCross', async () => {
    const { marginModeController, captured } = build({
      getCurrentState: () => ({ leverage: 8, isCross: true }),
    })
    const result = await marginModeController.setMarginMode('BTC-PERP', 'isolated')
    expect(result.isOk()).toBe(true)
    expect(captured.params).toEqual([{ asset: 0, isCross: false, leverage: 8 }])
  })

  it('returns a typed rejected error when no signing wallet is available', async () => {
    const { marginModeController, captured } = build({ getAgentWallet: () => null })
    const result = await marginModeController.setMarginMode('BTC-PERP', 'cross')
    expect(result.isErr()).toBe(true)
    result.match(
      () => expect.fail('expected error'),
      (e) => expect((e as SetMarginModeError).kind).toBe('rejected'),
    )
    expect(captured.params).toHaveLength(0)
  })
})
