import type {
  AllDexsClearinghouseStateEvent,
  ClearinghouseStateResponse,
} from '../../gateway/sdk-types'

/**
 * Build a synthetic-but-shape-correct asset position for tests. Numeric values
 * are stringified to match the SDK's wire shape. Fields default to safe values;
 * override via `partial`. There is NO `markPx` — consumers derive the mark
 * price from `positionValue / |szi|`.
 */
export function buildAssetPosition(partial: Partial<{
  coin: string
  szi: string
  entryPx: string
  positionValue: string
  unrealizedPnl: string
  returnOnEquity: string
  leverageType: 'cross' | 'isolated'
  leverageValue: number
  liquidationPx: string | null
  marginUsed: string
}> = {}): ClearinghouseStateResponse['assetPositions'][number] {
  return {
    type: 'oneWay',
    position: {
      coin: partial.coin ?? 'BTC',
      szi: partial.szi ?? '0',
      entryPx: partial.entryPx ?? '0',
      positionValue: partial.positionValue ?? '0',
      unrealizedPnl: partial.unrealizedPnl ?? '0',
      returnOnEquity: partial.returnOnEquity ?? '0',
      leverage:
        partial.leverageType === 'isolated'
          ? { type: 'isolated', value: partial.leverageValue ?? 1, rawUsd: '0' }
          : { type: 'cross', value: partial.leverageValue ?? 1 },
      liquidationPx: partial.liquidationPx ?? null,
      marginUsed: partial.marginUsed ?? '0',
      maxLeverage: 50,
      cumFunding: { allTime: '0', sinceOpen: '0', sinceChange: '0' },
    },
  } as unknown as ClearinghouseStateResponse['assetPositions'][number]
}

/**
 * Build a synthetic `ClearinghouseStateResponse` carrying the given asset
 * positions. All margin/equity fields default to safe zeros — positions are the
 * only thing the perps-positions reader projects.
 */
export function buildClearinghouseState(
  assetPositions: ReadonlyArray<ClearinghouseStateResponse['assetPositions'][number]> = [],
): ClearinghouseStateResponse {
  return {
    marginSummary: { accountValue: '0', totalNtlPos: '0', totalRawUsd: '0', totalMarginUsed: '0' },
    crossMarginSummary: { accountValue: '0', totalNtlPos: '0', totalRawUsd: '0', totalMarginUsed: '0' },
    crossMaintenanceMarginUsed: '0',
    withdrawable: '0',
    assetPositions: [...assetPositions],
    time: 0,
  } as unknown as ClearinghouseStateResponse
}

/**
 * Build a multi-dex `allDexsClearinghouseState` event. Each entry is a
 * `[dex, ClearinghouseStateResponse]` tuple — `dex === ''` is the main perp
 * dex; any other string (e.g. `'xyz'`) is a HIP-3 builder-deployed dex. This is
 * the SOLE source for all perp positions, so a realistic fixture covers both
 * the main dex and at least one HIP-3 dex.
 */
export function buildAllDexsClearinghouseStateEvent(partial: Partial<{
  user: `0x${string}`
  clearinghouseStates: [dex: string, state: ClearinghouseStateResponse][]
}> = {}): AllDexsClearinghouseStateEvent {
  return {
    user: partial.user ?? '0xabcdef0123456789abcdef0123456789abcdef01',
    clearinghouseStates: partial.clearinghouseStates ?? [],
  }
}
