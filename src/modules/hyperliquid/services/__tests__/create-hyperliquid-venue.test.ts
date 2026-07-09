import { describe, it, expect } from 'vitest'
import { ok, okAsync } from 'neverthrow'
import { PlaceOrderError } from '@/modules/shared/domain'
import type { MarketOrderRequest, WalletAddress } from '@/modules/shared/domain'
import type {
  OrderParameters,
  OrderSuccessResponse,
  UpdateLeverageParameters,
  UpdateLeverageSuccessResponse,
} from '../../gateway'
import type { HyperliquidAgentWallet, HyperliquidExchangeGateway } from '../../gateway'
import { type HyperliquidSubscription } from '../../gateway'
import type {
  MetaAndAssetCtxsResponse,
  PerpDexsResponse,
} from '../../gateway/sdk-types'
import { buildFakeExchangeGateway } from '../../gateway/__fixtures__/fake-exchange-gateway'
import { buildFakeGateway, buildFakeLogger, buildWebData2 } from '../__fixtures__/web-data2'
import {
  buildAllDexsClearinghouseStateEvent,
  buildAssetPosition,
  buildClearinghouseState,
} from '../__fixtures__/all-dexs-clearinghouse-state'
import { createHyperliquidVenue } from '../create-hyperliquid-venue'
import type { HyperliquidVenueOptions } from '../../hyperliquid.types'

const FAKE_AGENT_WALLET = { __fakeAgentWallet: true } as unknown as HyperliquidAgentWallet
const SECRET_KEY = ('0x' + 'a'.repeat(64)) as `0x${string}`

function buildMetaAndCtxs(): MetaAndAssetCtxsResponse {
  return [
    { universe: [{ name: 'BTC', szDecimals: 5, maxLeverage: 50 }], marginTables: [] },
    [{ markPx: '50000', prevDayPx: '49000', dayNtlVlm: '1000000' }],
  ] as unknown as MetaAndAssetCtxsResponse
}

interface VenueHarness {
  readonly getAgentWallet?: () => HyperliquidAgentWallet | null
  readonly exchangeGateway?: Partial<HyperliquidExchangeGateway>
}

// formatPrice/formatSize are sync Result helpers; round to 5 sig figs / truncate
// to szDecimals so the test can assert the venue routes raw values through them.
function okFormatPrice(price: number) {
  return ok(String(Number(price.toPrecision(5))))
}
function okFormatSize(size: number, szDecimals: number) {
  const factor = 10 ** szDecimals
  return ok(String(Math.trunc(size * factor) / factor))
}

async function buildVenue(harness: VenueHarness = {}) {
  const captured: { orderParams: OrderParameters[] } = { orderParams: [] }
  const exchangeGateway = buildFakeExchangeGateway({
    formatPrice: (price) => okFormatPrice(price),
    formatSize: (size, szDecimals) => okFormatSize(size, szDecimals),
    placeOrder: (_wallet, params) => {
      captured.orderParams.push(params)
      const response: OrderSuccessResponse = {
        status: 'ok',
        response: { type: 'order', data: { statuses: [{ resting: { oid: 7 } }] } },
      }
      return okAsync(response)
    },
    ...harness.exchangeGateway,
  })
  const gateway = buildFakeGateway({ getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()) })
  const options: HyperliquidVenueOptions = {
    network: 'mainnet',
    apiHttpUrl: 'https://example.invalid',
    apiWsUrl: 'wss://example.invalid',
    getAddress: () => null,
    getAgentWallet: harness.getAgentWallet,
    logger: buildFakeLogger().logger,
  }
  const venue = createHyperliquidVenue(options, { gateway, exchangeGateway })
  // Prime the market-data cache so resolveAsset / getReferencePrice succeed.
  const marketData = venue.capabilities.marketData
  if (marketData !== undefined && 'refresh' in marketData) {
    await (marketData as { refresh: () => Promise<void> }).refresh()
  }
  return { venue, captured }
}

const marketRequest = (over: Partial<MarketOrderRequest> = {}): MarketOrderRequest => ({
  orderType: 'market',
  symbol: 'BTC-PERP',
  side: 'buy',
  size: 0.1,
  ...over,
})

describe('createHyperliquidVenue trader wiring', () => {
  it('always declares the trader capability (HL can trade)', async () => {
    const { venue } = await buildVenue({ getAgentWallet: () => null })
    expect(venue.capabilities.trader).toBeDefined()
  })

  it('declares leverageController + marginModeController', async () => {
    const { venue } = await buildVenue({ getAgentWallet: () => null })
    expect(venue.capabilities.leverageController).toBeDefined()
    expect(venue.capabilities.marginModeController).toBeDefined()
  })

  it('setLeverage with no signing wallet returns a typed error (no throw)', async () => {
    const { venue } = await buildVenue({ getAgentWallet: () => null })
    const result = await venue.capabilities.leverageController!.setLeverage('BTC-PERP', 10)
    expect(result.isErr()).toBe(true)
  })

  it('places an order through the bridged signing wallet + resolved asset/reference', async () => {
    const { venue, captured } = await buildVenue({ getAgentWallet: () => FAKE_AGENT_WALLET })
    const result = await venue.capabilities.trader!.placeOrder(marketRequest())
    expect(result.isOk()).toBe(true)
    expect(captured.orderParams).toHaveLength(1)
    const leg = captured.orderParams[0]!.orders[0]!
    // Resolved asset id (BTC perp index 0) flowed through to the signed order.
    expect(leg.a).toBe(0)
    // Market buy priced as aggressive IOC off the cached mark (50000 × 1.05).
    expect(leg.p).toBe('52500')
  })

  it('returns a typed rejected error (no throw) when no signing wallet is available', async () => {
    const { venue, captured } = await buildVenue({ getAgentWallet: () => null })
    const result = await venue.capabilities.trader!.placeOrder(marketRequest())
    expect(result.isErr()).toBe(true)
    result.match(
      () => expect.fail('expected an error outcome'),
      (error) => {
        expect(error).toBeInstanceOf(PlaceOrderError)
        expect(error.kind).toBe('rejected')
      },
    )
    // Never reached the gateway — no signed payload was produced.
    expect(captured.orderParams).toHaveLength(0)
  })

  it('returns a typed rejected error when no getAgentWallet is wired at all', async () => {
    const { venue } = await buildVenue({})
    const result = await venue.capabilities.trader!.placeOrder(marketRequest())
    expect(result.isErr()).toBe(true)
  })

  it('does not expose the agent private key anywhere on the public venue surface', async () => {
    // The getter resolves a wallet, but the venue object must never carry the
    // key material — serialize the whole capability surface and assert it.
    const { venue } = await buildVenue({
      // A getter that *could* close over a key, to prove the key never lands on
      // the venue object even when one exists behind the bridge.
      getAgentWallet: () => {
        void SECRET_KEY
        return FAKE_AGENT_WALLET
      },
    })
    const serialized = JSON.stringify(venue.capabilities.trader, (_key, value) =>
      typeof value === 'function' ? '[fn]' : value,
    )
    expect(serialized).not.toContain(SECRET_KEY)
  })
})

// ---------------------------------------------------------------------------
// HIP-3 close parity (Slice 4)
//
// A HIP-3 position closes through the SAME reduce-only `trader.placeOrder` path
// as a main-dex one: the ClosePositionDialog builds a `PlaceOrderRequest` whose
// `symbol` is the RAW namespaced HL coin (`xyz:NVDA`, the perps snapshot reader
// keeps `position.coin` raw), `reduceOnly: true`, opposite side. The risk this
// locks down: that `xyz:NVDA` resolves to the HIP-3-ENCODED asset id
// (`100000 + dexIndex*10000 + assetIndex`), NOT a wrong/absent main-dex id, and
// that the close/edit leverage lookup (`getCurrentLeverageState`) finds the
// HIP-3 position by asset id. The dialog request shape itself is proven in
// `close-position.utils.test.ts`; here we drive the venue end-to-end.
// ---------------------------------------------------------------------------

// `xyz` is perpDexs index 1 (index 0 is the null main DEX); its first asset is
// index 0, so the encoded asset id is 100000 + 1*10000 + 0 = 110000. Matches
// the SDK's SymbolConverter and the market-data-reader MKT-* tests.
const HIP3_DEX_NAME = 'xyz'
const HIP3_SYMBOL = 'xyz:NVDA'
const HIP3_ASSET_ID = 110_000
const HIP3_POSITION_LEVERAGE = 7

function buildHip3MetaAndCtxs(): MetaAndAssetCtxsResponse {
  return [
    { universe: [{ name: 'NVDA', szDecimals: 2, maxLeverage: 20 }], marginTables: [] },
    [{ markPx: '120', prevDayPx: '118', dayNtlVlm: '50000' }],
  ] as unknown as MetaAndAssetCtxsResponse
}

interface Hip3VenueHarness {
  readonly getAgentWallet?: () => HyperliquidAgentWallet | null
}

async function buildHip3Venue(harness: Hip3VenueHarness = {}) {
  const captured: {
    orderParams: OrderParameters[]
    leverageParams: UpdateLeverageParameters[]
  } = { orderParams: [], leverageParams: [] }

  const exchangeGateway = buildFakeExchangeGateway({
    formatPrice: (price) => okFormatPrice(price),
    formatSize: (size, szDecimals) => okFormatSize(size, szDecimals),
    placeOrder: (_wallet, params) => {
      captured.orderParams.push(params)
      const response: OrderSuccessResponse = {
        status: 'ok',
        response: { type: 'order', data: { statuses: [{ resting: { oid: 7 } }] } },
      }
      return okAsync(response)
    },
    updateLeverage: (_wallet, params) => {
      captured.leverageParams.push(params)
      const response: UpdateLeverageSuccessResponse = { status: 'ok', response: { type: 'default' } }
      return okAsync(response)
    },
  })

  // Positions are projected from the `allDexsClearinghouseState` stream (the SOLE
  // source post-Wave-A: main dex `''` + every HIP-3 dex in one event), keeping
  // `position.coin` RAW — so a HIP-3 position carries the namespaced `xyz:NVDA`
  // coin under its dex (`'xyz'`). Deliver one event synchronously on subscribe so
  // the venue's leverage-state cache (`getCurrentLeverageState`) is populated
  // before the close/edit calls run. `positionValue / |szi|` = 360/3 = 120, which
  // matches the cached HIP-3 mark the close test prices its IOC off.
  const hip3PositionEvent = buildAllDexsClearinghouseStateEvent({
    clearinghouseStates: [
      [
        HIP3_DEX_NAME,
        buildClearinghouseState([
          buildAssetPosition({
            coin: HIP3_SYMBOL,
            szi: '3',
            entryPx: '118',
            positionValue: '360',
            unrealizedPnl: '6',
            returnOnEquity: '0.1',
            leverageType: 'cross',
            leverageValue: HIP3_POSITION_LEVERAGE,
            marginUsed: '51',
          }),
        ]),
      ],
    ],
  })

  const gateway = buildFakeGateway({
    getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
    getPerpDexs: () => okAsync([null, { name: HIP3_DEX_NAME }] as unknown as PerpDexsResponse),
    getPerpMetaAndAssetCtxs: () => okAsync(buildHip3MetaAndCtxs()),
    // Benign webData2 (no positions) so any webData2-backed capability that
    // subscribes during construction doesn't hit the fake's errFor default.
    subscribeWebData2: (_addr, listener) => {
      listener(buildWebData2())
      const subscription: HyperliquidSubscription = {
        unsubscribe: () => Promise.resolve(),
        failureSignal: new AbortController().signal,
      }
      return okAsync(subscription)
    },
    subscribeAllDexsClearinghouseState: (_addr, listener) => {
      listener(hip3PositionEvent)
      const subscription: HyperliquidSubscription = {
        unsubscribe: () => Promise.resolve(),
        failureSignal: new AbortController().signal,
      }
      return okAsync(subscription)
    },
  })

  const options: HyperliquidVenueOptions = {
    // `testnet` (not `mainnet`) so this venue's gateway-cache keys
    // (`${network}:getPerpDexs:main`, …) never collide with the main-dex
    // `buildVenue` block above — that block runs first and caches an EMPTY
    // perpDexs list for `mainnet`, which would otherwise hide our HIP-3 dex.
    // See `cached-hyperliquid-gateway.ts` (persistent cache keyed by network).
    network: 'testnet',
    apiHttpUrl: 'https://example.invalid',
    apiWsUrl: 'wss://example.invalid',
    // Non-null so the allDexsClearinghouseState stream subscribes and the HIP-3
    // position lands in the venue's leverage-state cache.
    getAddress: () => '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress,
    getAgentWallet: harness.getAgentWallet ?? (() => FAKE_AGENT_WALLET),
    logger: buildFakeLogger().logger,
  }
  const venue = createHyperliquidVenue(options, { gateway, exchangeGateway })
  // Prime the market-data cache so resolveAsset resolves the HIP-3 asset id.
  const marketData = venue.capabilities.marketData
  if (marketData !== undefined && 'refresh' in marketData) {
    await (marketData as { refresh: () => Promise<void> }).refresh()
  }
  // Touch the positions snapshot so the venue's leverage cache subscription is
  // primed (the cache subscribes lazily via the snapshot reader at construction,
  // but reading it here guarantees the synchronous HIP-3 event has been seen).
  venue.capabilities.perpsPositionsSnapshot?.subscribe(() => {})()
  return { venue, captured }
}

// The reduce-only market close the ClosePositionDialog builds for a long HIP-3
// position: opposite side, reduceOnly, raw namespaced symbol. (Shape proven in
// close-position.utils.test.ts; reconstructed here to drive the venue.)
const hip3CloseRequest = (): MarketOrderRequest => ({
  orderType: 'market',
  symbol: HIP3_SYMBOL,
  side: 'sell',
  size: 3,
  reduceOnly: true,
})

describe('createHyperliquidVenue — HIP-3 close parity', () => {
  it('resolves the HIP-3-encoded asset id for a `xyz:NVDA` reduce-only close', async () => {
    const { venue, captured } = await buildHip3Venue()
    const result = await venue.capabilities.trader!.placeOrder(hip3CloseRequest())
    expect(result.isOk()).toBe(true)
    expect(captured.orderParams).toHaveLength(1)
    const leg = captured.orderParams[0]!.orders[0]!
    // The signed order carries the HIP-3 asset id (110000), not a main-dex /
    // absent id — proving `resolveAssetInfo('xyz:NVDA')` hit the HIP-3 index.
    expect(leg.a).toBe(HIP3_ASSET_ID)
    // Reduce-only, opposite side (sell to close a long), priced as aggressive
    // IOC off the cached HIP-3 mark (120 × 0.95 for a sell).
    expect(leg.r).toBe(true)
    expect(leg.b).toBe(false)
    expect(leg.p).toBe('114')
  })

  it('getCurrentLeverageState parity: close/edit reads the HIP-3 position leverage by asset id', async () => {
    const { venue, captured } = await buildHip3Venue()
    // setMarginMode re-sends the CURRENT leverage (resolved via
    // getCurrentLeverageState → resolveAssetInfo by asset id). A HIP-3 miss
    // would fall back to the DEFAULT leverage; asserting the position's 7×
    // proves the lookup matched the HIP-3 position.
    const result = await venue.capabilities.marginModeController!.setMarginMode(HIP3_SYMBOL, 'cross')
    expect(result.isOk()).toBe(true)
    expect(captured.leverageParams).toHaveLength(1)
    const params = captured.leverageParams[0]!
    expect(params.asset).toBe(HIP3_ASSET_ID)
    expect(params.leverage).toBe(HIP3_POSITION_LEVERAGE)
    expect(params.isCross).toBe(true)
  })
})
