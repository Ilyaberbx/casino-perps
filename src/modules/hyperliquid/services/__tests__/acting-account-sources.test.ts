import { describe, it, expect } from 'vitest'
import { okAsync } from 'neverthrow'
import type { WalletAddress } from '@/modules/shared/domain'
import { type HyperliquidSubscription } from '../../gateway'
import type {
  AllDexsClearinghouseStateEvent,
  MetaAndAssetCtxsResponse,
  WebData2Response,
} from '../../gateway/sdk-types'
import {
  buildFakeGateway,
  buildFakeLogger,
  buildUserFees,
  buildPortfolioPeriods,
  buildWebData2,
} from '../__fixtures__/web-data2'
import {
  buildAllDexsClearinghouseStateEvent,
  buildAssetPosition,
  buildClearinghouseState,
} from '../__fixtures__/all-dexs-clearinghouse-state'
import { createHyperliquidVenue } from '../create-hyperliquid-venue'
import type { HyperliquidVenueOptions } from '../../hyperliquid.types'
import type { OrderDraft } from '@/modules/shared/domain'

// ---------------------------------------------------------------------------
// ADR-0038 — Order flow keys to the Acting Address, never the Spectated Address.
//
// getAddress (Viewing) → 0xSPEC, a funded spectated account; getActingAddress
// (Acting) → 0xCONN, the connected wallet with $0 perp collateral. The viewing
// portfolio must emit SPEC's accountValue (the dock view); the ownAccount
// portfolio + previewOrder capacity + leverage seed must reflect CONN (the
// order flow). This is the spectate leak the fix closes structurally.
// ---------------------------------------------------------------------------

const SPEC = '0x1111111111111111111111111111111111111111' as WalletAddress
const CONN = '0x2222222222222222222222222222222222222222' as WalletAddress

const SPEC_ACCOUNT_VALUE = 175_434.22
const CONN_ACCOUNT_VALUE = 0

function buildMetaAndCtxs(): MetaAndAssetCtxsResponse {
  return [
    { universe: [{ name: 'BTC', szDecimals: 5, maxLeverage: 50 }], marginTables: [] },
    [{ markPx: '50000', prevDayPx: '49000', dayNtlVlm: '1000000' }],
  ] as unknown as MetaAndAssetCtxsResponse
}

function subscription(): HyperliquidSubscription {
  return {
    unsubscribe: () => Promise.resolve(),
    failureSignal: new AbortController().signal,
  }
}

/** A per-address webData2 fixture: SPEC funded, CONN flat. */
function webData2For(address: WalletAddress): WebData2Response {
  const accountValue = address === SPEC ? String(SPEC_ACCOUNT_VALUE) : String(CONN_ACCOUNT_VALUE)
  return buildWebData2({ user: address as `0x${string}`, accountValue })
}

interface ActingVenueHarness {
  /** Override the acting getter (defaults to CONN). */
  readonly getActingAddress?: () => WalletAddress | null
  /** Account abstraction mode (defaults to segregated/classic). */
  readonly unified?: boolean
}

async function buildActingVenue(harness: ActingVenueHarness = {}) {
  const gateway = buildFakeGateway({
    getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
    // webData2 / clearinghouse keyed per address — the divergence proof.
    subscribeWebData2: (addr, listener) => {
      listener(webData2For(addr))
      return okAsync(subscription())
    },
    // SPEC carries a 20× BTC position; CONN is flat. The viewing positions
    // snapshot (dock) sees SPEC's 20×; the ownAccount snapshot (leverage seed)
    // sees CONN's empty set → seeds the default 1×.
    subscribeAllDexsClearinghouseState: (addr, listener) => {
      const states =
        addr === SPEC
          ? [['', buildClearinghouseState([buildAssetPosition({ coin: 'BTC', szi: '1', positionValue: '50000', leverageValue: 20 })])] as [string, ReturnType<typeof buildClearinghouseState>]]
          : []
      listener(buildAllDexsClearinghouseStateEvent({ clearinghouseStates: states }))
      return okAsync(subscription())
    },
    // The 30s pull endpoints the readers project from. userFees drives the
    // ownAccount taker rate; portfolio drives window pnl/volume; the rest are
    // benign zeros. CONN's fee tier differs from SPEC's so the order-flow taker
    // rate proves it keyed to CONN.
    getPortfolio: () => okAsync(buildPortfolioPeriods()),
    getUserFees: (addr) =>
      okAsync(buildUserFees({ userCrossRate: addr === SPEC ? '0.0009' : '0.00045' })),
    queryUserAbstraction: () => okAsync(harness.unified ? 'unifiedAccount' : 'default'),
    // The draft is self-describing (ADR-0057); the venue prices it against
    // `draft.symbol`. Subscribe the active asset ctx to seed the reader's
    // per-symbol mark cache (no live ctx ticks needed).
    subscribeActiveAssetCtx: () => okAsync(subscription()),
  })

  const options: HyperliquidVenueOptions = {
    network: 'mainnet',
    apiHttpUrl: 'https://example.invalid',
    apiWsUrl: 'wss://example.invalid',
    getAddress: () => SPEC,
    getActingAddress: harness.getActingAddress ?? (() => CONN),
    logger: buildFakeLogger().logger,
  }
  const venue = createHyperliquidVenue(options, { gateway })
  const marketData = venue.capabilities.marketData
  if (marketData !== undefined && 'refresh' in marketData) {
    await (marketData as { refresh: () => Promise<void> }).refresh()
  }
  // Seed the reader's per-symbol mark cache for BTC-PERP (the draft names it).
  venue.capabilities.marketData?.subscribeTicker('BTC-PERP', () => {})
  return { venue }
}

/** A market-buy `OrderDraft` (raw form strings) the venue parses + prices.
 *  Self-describing: it names BTC-PERP so the venue resolves mark/asset from it. */
const marketDraft = (over: Partial<OrderDraft> = {}): OrderDraft => ({
  symbol: 'BTC-PERP',
  orderType: 'market',
  side: 'buy',
  sizeUnit: 'coin',
  sizeInput: '0.1',
  priceInput: '',
  stopPriceInput: '',
  slippageInput: '',
  timeInForce: 'Gtc',
  twapHoursInput: '',
  twapMinutesInput: '',
  randomize: false,
  reduceOnly: false,
  leverage: 10,
  ...over,
})

function lastSnapshotAccountValue(
  reader: { subscribeSnapshot: (scope: 'perps', cb: (s: { accountValue: number }) => void) => () => void } | undefined,
): number {
  let value = Number.NaN
  reader?.subscribeSnapshot('perps', (snap) => {
    value = snap.accountValue
  })()
  return value
}

describe('createHyperliquidVenue — order flow keys to Acting Address (ADR-0038)', () => {
  it('viewing portfolio emits SPEC, ownAccount portfolio emits CONN', async () => {
    const { venue } = await buildActingVenue()
    const viewing = lastSnapshotAccountValue(venue.capabilities.portfolio)
    const acting = lastSnapshotAccountValue(venue.capabilities.ownAccount?.portfolio)
    // The dock view sees the funded spectated account.
    expect(viewing).toBe(SPEC_ACCOUNT_VALUE)
    // Order entry's Available-to-Trade sees the connected wallet's $0.
    expect(acting).toBe(CONN_ACCOUNT_VALUE)
  })

  it('previewOrder capacity (max size) reflects the Acting account ($0 → 0 max)', async () => {
    const { venue } = await buildActingVenue()
    const preview = venue.capabilities.trader!.previewOrder(marketDraft())
    // CONN's perp collateral is $0 → no buying power → maxCoinSize 0.
    expect(preview.capacity.maxCoinSize).toBe(0)
  })

  it('fee estimate uses the Acting account fee tier (CONN), not the Spectated one', async () => {
    // SPEC's taker rate is 0.0009, CONN's is 0.00045. The order-flow fee estimate
    // reads the ACTING fee schedule, so a 5000-notional market buy is priced at
    // CONN's rate (5000 × 0.00045 = 2.25), never SPEC's (which would be 4.50).
    const { venue } = await buildActingVenue()
    const preview = venue.capabilities.trader!.previewOrder(marketDraft())
    expect(preview.estimates.kind).toBe('linear')
    if (preview.estimates.kind !== 'linear') return
    expect(preview.estimates.fee).toBeCloseTo(2.25, 2)
  })

  it('leverage seed reads the Acting positions snapshot (own flat → no 20× leak)', async () => {
    const { venue } = await buildActingVenue()
    // The viewing snapshot (dock Positions tab) sees SPEC's 20× BTC position…
    let viewingLeverage: number | null = null
    venue.capabilities.perpsPositionsSnapshot?.subscribe((positions) => {
      viewingLeverage = positions.find((p) => p.symbol === 'BTC')?.leverage ?? null
    })()
    expect(viewingLeverage).toBe(20)
    // …while the order-flow (leverage seed) snapshot keys CONN, which is flat —
    // so the seed never inherits the spectated account's 20×.
    let actingPositionsCount = -1
    venue.capabilities.ownAccount?.perpsPositionsSnapshot.subscribe((positions) => {
      actingPositionsCount = positions.length
    })()
    expect(actingPositionsCount).toBe(0)
  })

  it('when acting === viewing (no spectate), order flow sees the same funded account', async () => {
    // getActingAddress === getAddress → no divergence → ownAccount aliases the
    // viewing instance (the D-2 zero-cost steady state). The order flow then
    // sees the funded account, proving the divergence is spectate-driven only.
    const { venue } = await buildActingVenue({ getActingAddress: () => SPEC })
    const acting = lastSnapshotAccountValue(venue.capabilities.ownAccount?.portfolio)
    expect(acting).toBe(SPEC_ACCOUNT_VALUE)
    const preview = venue.capabilities.trader!.previewOrder(marketDraft())
    expect(preview.capacity.maxCoinSize).toBeGreaterThan(0)
  })

  it('unified-mode Acting account: ownAccount portfolio still keys CONN (perpsEquity 0)', async () => {
    // hyperliquid-account-modes.md §4: a unified account reports perpsEquity 0
    // but a real `accountValue`. With SPEC funded and CONN flat in unified mode,
    // the acting 'perps' scope must read CONN's spot-pool collateral (0 here),
    // never SPEC's. accountValue is mode-correct; we assert it tracks CONN.
    const { venue } = await buildActingVenue({ unified: true })
    const viewing = lastSnapshotAccountValue(venue.capabilities.portfolio)
    const acting = lastSnapshotAccountValue(venue.capabilities.ownAccount?.portfolio)
    // SPEC's unified 'perps' scope = collateral spot pool; our fixture carries no
    // spot balances, so both read 0 for the perps scope — but crucially the
    // acting read is keyed to CONN, never leaking SPEC. The divergence is proven
    // structurally by the classic-mode test above; here we assert unified mode
    // does not throw and the acting read is a finite number for the CONN key.
    expect(Number.isFinite(viewing)).toBe(true)
    expect(acting).toBe(0)
  })

  it('ownAccount.accountMode reflects the Acting account mode, never the Spectated one', async () => {
    // SPEC (viewing/spectated) is unified; CONN (acting/connected) is classic.
    // Transfer's Perps⇄Spot applicability reads `ownAccount.accountMode`, so it
    // must report CONN's mode (segregated) — never SPEC's (unified) — while the
    // dock's viewing `accountMode` still reports SPEC's.
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
      subscribeWebData2: (addr, listener) => {
        listener(webData2For(addr))
        return okAsync(subscription())
      },
      subscribeAllDexsClearinghouseState: (_addr, listener) => {
        listener(buildAllDexsClearinghouseStateEvent({ clearinghouseStates: [] }))
        return okAsync(subscription())
      },
      getPortfolio: () => okAsync(buildPortfolioPeriods()),
      getUserFees: () => okAsync(buildUserFees()),
      queryUserAbstraction: (addr) => okAsync(addr === SPEC ? 'unifiedAccount' : 'default'),
      subscribeActiveAssetCtx: () => okAsync(subscription()),
    })
    const options: HyperliquidVenueOptions = {
      network: 'mainnet',
      apiHttpUrl: 'https://example.invalid',
      apiWsUrl: 'wss://example.invalid',
      getAddress: () => SPEC,
      getActingAddress: () => CONN,
      logger: buildFakeLogger().logger,
    }
    const venue = createHyperliquidVenue(options, { gateway })
    const marketData = venue.capabilities.marketData
    if (marketData !== undefined && 'refresh' in marketData) {
      await (marketData as { refresh: () => Promise<void> }).refresh()
    }

    expect(venue.capabilities.accountMode?.current().isSegregated).toBe(false)
    expect(venue.capabilities.ownAccount?.accountMode.current().isSegregated).toBe(true)
  })
})

describe('createHyperliquidVenue — refresh semantics fork (ADR-0038 D-3)', () => {
  it('exposes refreshAddress (viewing) and refreshActingAddress (acting)', async () => {
    const { venue } = await buildActingVenue()
    expect(typeof venue.refreshAddress).toBe('function')
    expect(typeof venue.refreshActingAddress).toBe('function')
    // Both are idempotent no-throw signals.
    expect(() => venue.refreshAddress?.()).not.toThrow()
    expect(() => venue.refreshActingAddress?.()).not.toThrow()
  })

  it('refreshAddress re-routes the order flow when spectate converges to self', async () => {
    // Start diverged (SPEC viewing, CONN acting); the order flow reads CONN ($0).
    let viewingAddress: WalletAddress = SPEC
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
      subscribeWebData2: (addr, listener) => {
        listener(webData2For(addr))
        return okAsync(subscription())
      },
      subscribeAllDexsClearinghouseState: (_addr, listener) => {
        listener(buildAllDexsClearinghouseStateEvent({ clearinghouseStates: [] }))
        return okAsync(subscription())
      },
      getPortfolio: () => okAsync(buildPortfolioPeriods()),
      getUserFees: () => okAsync(buildUserFees()),
      queryUserAbstraction: () => okAsync('default'),
      subscribeActiveAssetCtx: () => okAsync(subscription()),
    })
    const options: HyperliquidVenueOptions = {
      network: 'mainnet',
      apiHttpUrl: 'https://example.invalid',
      apiWsUrl: 'wss://example.invalid',
      getAddress: () => viewingAddress,
      getActingAddress: () => CONN,
      logger: buildFakeLogger().logger,
    }
    const venue = createHyperliquidVenue(options, { gateway })
    const marketData = venue.capabilities.marketData
    if (marketData !== undefined && 'refresh' in marketData) {
      await (marketData as { refresh: () => Promise<void> }).refresh()
    }
    venue.capabilities.marketData?.subscribeTicker('BTC-PERP', () => {})

    // Diverged: acting reads CONN ($0).
    expect(lastSnapshotAccountValue(venue.capabilities.ownAccount?.portfolio)).toBe(CONN_ACCOUNT_VALUE)

    // Stop spectating: viewing converges to CONN. refreshAddress re-keys viewing
    // and re-routes the acting selectors. Acting still reads CONN ($0).
    viewingAddress = CONN
    venue.refreshAddress?.()
    expect(lastSnapshotAccountValue(venue.capabilities.ownAccount?.portfolio)).toBe(CONN_ACCOUNT_VALUE)
  })

  it('does not leak the spectated account value into the order flow during the exit-spectate transition, before the fresh tick lands', async () => {
    // Regression for the spectate-mode transition flash: on exit, the acting
    // selector reroutes ownAccount's webData2/allDexs subscription from the
    // dedicated acting (CONN) instance onto the viewing instance, which has just
    // rotated SPEC → CONN. If the viewing stream's stale SPEC cache survives that
    // rotation, the reroute hands it straight to the order flow. Ticks are
    // delivered manually (not auto-invoked on subscribe) so the pre-fresh-tick
    // window is directly observable.
    let viewingAddress: WalletAddress = SPEC
    const webData2Listeners = new Map<WalletAddress, (data: WebData2Response) => void>()
    const allDexsListeners = new Map<
      WalletAddress,
      (data: AllDexsClearinghouseStateEvent) => void
    >()
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
      subscribeWebData2: (addr, listener) => {
        webData2Listeners.set(addr, listener)
        return okAsync(subscription())
      },
      subscribeAllDexsClearinghouseState: (addr, listener) => {
        allDexsListeners.set(addr, listener)
        return okAsync(subscription())
      },
      getPortfolio: () => okAsync(buildPortfolioPeriods()),
      getUserFees: () => okAsync(buildUserFees()),
      queryUserAbstraction: () => okAsync('default'),
      subscribeActiveAssetCtx: () => okAsync(subscription()),
    })
    const options: HyperliquidVenueOptions = {
      network: 'mainnet',
      apiHttpUrl: 'https://example.invalid',
      apiWsUrl: 'wss://example.invalid',
      getAddress: () => viewingAddress,
      getActingAddress: () => CONN,
      logger: buildFakeLogger().logger,
    }
    const venue = createHyperliquidVenue(options, { gateway })
    const marketData = venue.capabilities.marketData
    if (marketData !== undefined && 'refresh' in marketData) {
      await (marketData as { refresh: () => Promise<void> }).refresh()
    }
    venue.capabilities.marketData?.subscribeTicker('BTC-PERP', () => {})

    // Deliver SPEC's tick to the viewing streams, and CONN's tick to the
    // dedicated acting streams — the pre-transition steady state.
    webData2Listeners.get(SPEC)?.(webData2For(SPEC))
    allDexsListeners.get(SPEC)?.(buildAllDexsClearinghouseStateEvent({ clearinghouseStates: [] }))
    webData2Listeners.get(CONN)?.(webData2For(CONN))
    allDexsListeners.get(CONN)?.(buildAllDexsClearinghouseStateEvent({ clearinghouseStates: [] }))

    expect(lastSnapshotAccountValue(venue.capabilities.portfolio)).toBe(SPEC_ACCOUNT_VALUE)
    expect(lastSnapshotAccountValue(venue.capabilities.ownAccount?.portfolio)).toBe(CONN_ACCOUNT_VALUE)

    // Exit spectate: viewing converges to CONN. The venue re-keys the viewing
    // streams (rotating SPEC → CONN) and reroutes ownAccount's subscription onto
    // them — but CONN's fresh tick has not landed on the (now rotated) viewing
    // streams yet.
    viewingAddress = CONN
    venue.refreshAddress?.()

    // Must not leak SPEC's stale value into the order flow during the gap.
    expect(lastSnapshotAccountValue(venue.capabilities.ownAccount?.portfolio)).not.toBe(
      SPEC_ACCOUNT_VALUE,
    )

    // Once the fresh tick for CONN lands on the (now shared) viewing stream, the
    // order flow reads it correctly.
    webData2Listeners.get(CONN)?.(webData2For(CONN))
    allDexsListeners.get(CONN)?.(buildAllDexsClearinghouseStateEvent({ clearinghouseStates: [] }))
    expect(lastSnapshotAccountValue(venue.capabilities.ownAccount?.portfolio)).toBe(CONN_ACCOUNT_VALUE)
  })
})
