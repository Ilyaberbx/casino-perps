import { okAsync } from 'neverthrow'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { VenueContext } from '../../../../shared/providers/venue-provider/venue-provider.context'
import { SelectedMarketContext } from '../../../providers/selected-market-provider/selected-market-provider.context'
import { LeverageMarginProvider } from '../../../providers/leverage-margin'
import { FakeOrderIntentProvider } from '../../../providers/order-intent-provider/__fixtures__/fake-order-intent-provider'
import { SpectateContext } from '@/modules/spectate/providers/spectate-provider/spectate-provider.context'
import type { SpectateContextValue } from '@/modules/spectate'
import type { OrderIntent } from '../../../trading.types'
import type {
  Balance,
  BalancesReader,
  Market,
  PerpPositionSnapshot,
  PerpsPositionsSnapshotReader,
  PortfolioReader,
  PortfolioSnapshot,
  Trader,
  Venue,
} from '../../../../shared/domain'
import { buildFakeOrderValidation } from './fake-order-validation'

/**
 * The shared order-entry test harness: a fake `Venue` whose validation/preview
 * are priced against the test's own market + mark, wrapped in the provider stack
 * the ticket hooks read (spectate, venue, selected market, leverage, order
 * intent). Consumed by both the Pro (`use-order-entry`) and Simple
 * (`use-simple-order-ticket`) hook suites so they cannot drift apart.
 */

export interface VenueOptions {
  supportsTriggerOrders?: boolean
  supportsStopOrders?: boolean
  supportsTwap?: boolean
  portfolio?: PortfolioSnapshot
  balances?: ReadonlyArray<Balance>
  positions?: ReadonlyArray<PerpPositionSnapshot>
}

export const DEFAULT_PERP_MARKET: Market = {
  symbol: 'BTC-PERP',
  baseAsset: 'BTC',
  quoteAsset: 'USD',
  venue: 'mock',
  tickSize: 0.5,
  stepSize: 0.001,
  marketType: 'perp',
  hlCoin: 'BTC',
}

export const SPOT_MARKET: Market = {
  symbol: 'PURR/USDC',
  baseAsset: 'PURR',
  quoteAsset: 'USDC',
  venue: 'mock',
  tickSize: 0.0001,
  stepSize: 1,
  marketType: 'spot',
  hlCoin: 'PURR/USDC',
}

export function buildPortfolio(snapshot: PortfolioSnapshot): PortfolioReader {
  return {
    subscribeSnapshot: (_scope, onUpdate) => {
      onUpdate(snapshot)
      return () => {}
    },
    getHistory: () => okAsync([]),
  }
}

export function buildBalances(rows: ReadonlyArray<Balance>): BalancesReader {
  return {
    subscribe: (_scope, onUpdate) => {
      onUpdate(rows)
      return () => {}
    },
  }
}

/** A flat position (size 0) that only carries leverage — seeds the ticket's
 *  leverage (via `useLeverageMargin`) for margin-unit tests. */
export function buildPosition(leverage: number): PerpPositionSnapshot {
  return {
    symbol: 'BTC-PERP',
    side: 'long',
    size: 0,
    entryPrice: 0,
    markPrice: 0,
    positionValueUsd: 0,
    unrealizedPnlUsd: 0,
    roePct: 0,
    leverage,
    leverageType: 'cross',
    liquidationPrice: null,
    marginUsedUsd: 0,
  }
}

export function buildSpotBalance(asset: string, available: number): Balance {
  return { asset, amount: available, available, amountUsd: 0, pnlPct: null, source: 'spot' }
}

export function buildSpectate(overrides: Partial<SpectateContextValue> = {}): SpectateContextValue {
  return {
    spectatedAddress: null,
    isSpectating: false,
    startSpectating: () => {},
    stopSpectating: () => {},
    watchlist: [],
    addToWatchlist: () => {},
    removeFromWatchlist: () => {},
    isWatchlisted: () => false,
    ...overrides,
  }
}

// A placeholder validation; `withMarketContext` (in `buildWrapper`) replaces it
// with one priced against the test's market + mark.
const placeholderValidation = buildFakeOrderValidation({
  symbol: 'BTC-PERP',
  markPrice: 0,
  availableMargin: 0,
})

/** The acting-keyed order-flow group (ADR-0038). Mirrors whichever viewing
 *  readers the test supplied; absent slots fall back to inert fakes so the group
 *  shape is always complete (the hook only subscribes to the slots it needs). */
function buildOwnAccount(
  portfolio: PortfolioReader | undefined,
  balances: BalancesReader | undefined,
  perpsPositionsSnapshot: PerpsPositionsSnapshotReader | undefined,
): Venue['capabilities']['ownAccount'] {
  return {
    portfolio: portfolio ?? { subscribeSnapshot: () => () => {}, getHistory: () => okAsync([]) },
    balances: balances ?? { subscribe: () => () => {} },
    perpsPositionsSnapshot: perpsPositionsSnapshot ?? { subscribe: () => () => {} },
    feeSchedule: { subscribe: () => () => {} },
    accountMode: { current: () => ({ isSegregated: true }), subscribe: () => () => {} },
  }
}

export function buildVenue(placeOrderSpy: Trader['placeOrder'], options: VenueOptions = {}): Venue {
  const positions = options.positions
  const validation = placeholderValidation
  // Order entry reads Available-to-Trade / spot sizing / Current-Position from
  // the ACTING account group (`ownAccount`, ADR-0038). With no spectate concept
  // in these tests acting === viewing, so the same reader fakes back both the
  // viewing capabilities (read by `withMarketContext`'s validation pricing) and
  // the `ownAccount` group (read by the hook).
  const portfolio = options.portfolio ? buildPortfolio(options.portfolio) : undefined
  const balances = options.balances ? buildBalances(options.balances) : undefined
  const perpsPositionsSnapshot: PerpsPositionsSnapshotReader | undefined = positions
    ? {
        subscribe: (onUpdate: (p: ReadonlyArray<PerpPositionSnapshot>) => void) => {
          onUpdate(positions)
          return () => {}
        },
      }
    : undefined
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      trader: {
        supportsTriggerOrders: options.supportsTriggerOrders,
        supportsStopOrders: options.supportsStopOrders,
        supportsTwap: options.supportsTwap,
        placeOrder: placeOrderSpy,
        cancelOrder: () => okAsync(undefined),
        validateDraft: validation.validateDraft,
        previewOrder: validation.previewOrder,
      },
      ...(portfolio ? { portfolio } : {}),
      ...(balances ? { balances } : {}),
      ...(perpsPositionsSnapshot ? { perpsPositionsSnapshot } : {}),
      ownAccount: buildOwnAccount(portfolio, balances, perpsPositionsSnapshot),
    },
  }
}

/** Recompose the venue's `validateDraft`/`previewOrder` so they price against
 *  the wrapper's `markPrice` + market (the venue's "active market" context). The
 *  available margin + spot balances are read synchronously from the venue's own
 *  fakes (they emit on subscribe). Keeps the per-test market context the single
 *  source of truth without threading it into every `buildVenue` call. */
export function withMarketContext(venue: Venue, markPrice: number, market: Market): Venue {
  const trader = venue.capabilities.trader
  if (trader === undefined) return venue
  let availableMargin = 0
  venue.capabilities.portfolio?.subscribeSnapshot('perps', (snap) => {
    availableMargin = snap.accountValue
  })()
  let spotUsdc = 0
  let spotBase = 0
  venue.capabilities.balances?.subscribe('all', (rows) => {
    for (const row of rows) {
      if (row.asset === 'USDC') spotUsdc = row.available
      else if (row.asset === market.baseAsset) spotBase = row.available
    }
  })()
  const validation = buildFakeOrderValidation({
    symbol: market.symbol,
    markPrice,
    availableMargin,
    isSpot: market.marketType === 'spot',
    spotUsdcAvailable: spotUsdc,
    spotBaseAvailable: spotBase,
    defaultSlippagePercent: 8,
  })
  return {
    ...venue,
    capabilities: {
      ...venue.capabilities,
      trader: {
        ...trader,
        validateDraft: validation.validateDraft,
        previewOrder: validation.previewOrder,
      },
    },
  }
}

export function buildWrapper(
  rawVenue: Venue,
  spectate: SpectateContextValue = buildSpectate(),
  markPrice?: number,
  marketOverride: Market = DEFAULT_PERP_MARKET,
  pendingIntent: OrderIntent | null = null,
) {
  const market: Market = { ...marketOverride, markPrice: markPrice ?? marketOverride.markPrice }
  const venue = withMarketContext(rawVenue, market.markPrice ?? 0, market)
  return ({ children }: { children: ReactNode }) =>
    createElement(
      SpectateContext.Provider,
      { value: spectate },
      createElement(
        VenueContext.Provider,
        { value: venue },
        createElement(
          SelectedMarketContext.Provider,
          {
            value: {
              selectedMarket: market.symbol,
              setSelectedMarket: () => {},
              market,
            },
          },
          // Leverage is shared via the provider — both the badge and order entry
          // read the same instance, so the harness must mount it too.
          createElement(
            LeverageMarginProvider,
            null,
            // The order ticket consumes the order-intent bus (#213); seed the
            // pending prefill (null for the non-prefill tests).
            createElement(FakeOrderIntentProvider, { pending: pendingIntent }, children),
          ),
        ),
      ),
    )
}
