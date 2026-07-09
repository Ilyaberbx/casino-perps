import { describe, it, expect, vi } from 'vitest'
import type { UserAbstractionResponse } from '../../gateway/sdk-types'
import type { HyperliquidPullService, HyperliquidPullSnapshot } from '../hyperliquid-pull'
import { createHyperliquidAccountModeReader } from '../account-mode-reader'
import { buildFakeLogger } from '../__fixtures__/web-data2'

function buildSnapshot(
  abstractionMode: UserAbstractionResponse | null,
): HyperliquidPullSnapshot {
  const emptyFamily = {
    pnl: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
    volume: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
  } as const
  return {
    portfolioCombined: emptyFamily,
    portfolioPerps: emptyFamily,
    fourteenDayVolume: 0,
    stakingHype: 0,
    earnSupplyByToken: new Map(),
    currentTier: null,
    userFees: null,
    spotPrices: new Map([['USDC', 1]]),
    spotTokenSymbolByIndex: new Map(),
    abstractionMode,
    unifiedCollateralTokenIndices: new Set([0]),
  }
}

function fakePull(abstractionMode: UserAbstractionResponse | null): HyperliquidPullService {
  const snapshot = buildSnapshot(abstractionMode)
  return {
    current: () => snapshot,
    subscribe: (onUpdate) => {
      onUpdate(snapshot)
      return () => {}
    },
    refreshAddress: () => {},
    stop: () => {},
  }
}

describe('createHyperliquidAccountModeReader', () => {
  const { logger } = buildFakeLogger()

  it('projects a classic account as segregated', () => {
    const reader = createHyperliquidAccountModeReader(fakePull('default'), logger)
    expect(reader.current().isSegregated).toBe(true)
  })

  it('projects a unified account as not segregated', () => {
    const reader = createHyperliquidAccountModeReader(fakePull('unifiedAccount'), logger)
    expect(reader.current().isSegregated).toBe(false)
  })

  it('projects portfolio margin as not segregated', () => {
    const reader = createHyperliquidAccountModeReader(fakePull('portfolioMargin'), logger)
    expect(reader.current().isSegregated).toBe(false)
  })

  it('defaults an unread mode (null) to segregated', () => {
    const reader = createHyperliquidAccountModeReader(fakePull(null), logger)
    expect(reader.current().isSegregated).toBe(true)
  })

  it('emits the current mode synchronously on subscribe', () => {
    const reader = createHyperliquidAccountModeReader(fakePull('unifiedAccount'), logger)
    const onChange = vi.fn()
    reader.subscribe(onChange)
    expect(onChange).toHaveBeenCalledWith({ isSegregated: false })
  })
})
