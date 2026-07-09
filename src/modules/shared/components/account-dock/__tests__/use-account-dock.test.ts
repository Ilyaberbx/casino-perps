import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { okAsync, errAsync, err } from 'neverthrow'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { VenueContext } from '@/modules/shared/providers/venue-provider/venue-provider.context'
import { SpectateContext } from '@/modules/spectate/providers/spectate-provider/spectate-provider.context'
import type { SpectateContextValue } from '@/modules/spectate'
import type {
  Venue,
  Order,
  Fill,
  PerpPositionSnapshot,
  PerpsPositionsSnapshotReader,
  OpenOrdersSnapshotReader,
  TradeHistoryReader,
  Trader,
  PositionProtection,
  ConnectionStatus,
  ConnectionStatusSource,
} from '@/modules/shared/domain'
import { useAccountDock } from '../use-account-dock'
import { DOCK_TABS } from '../account-dock.constants'

const MOCK_POSITION: PerpPositionSnapshot = {
  symbol: 'BTC-PERP',
  side: 'long',
  size: 1,
  entryPrice: 50000,
  markPrice: 51000,
  positionValueUsd: 51000,
  unrealizedPnlUsd: 1000,
  roePct: 2,
  leverage: 5,
  leverageType: 'cross',
  liquidationPrice: 40000,
  marginUsedUsd: 10000,
}

const MOCK_ORDER: Order = {
  identifier: 'order-1',
  symbol: 'BTC-PERP',
  side: 'buy',
  price: 49000,
  size: 1,
  filledSize: 0,
  status: 'open',
  orderType: 'limit',
  timestamp: 1,
}

const MOCK_FILL: Fill = {
  identifier: 'fill-1',
  orderIdentifier: 'order-1',
  symbol: 'BTC-PERP',
  side: 'buy',
  price: 50000,
  size: 1,
  fee: 0.1,
  timestamp: 1,
}

interface VenueOverrides {
  positions?: PerpsPositionsSnapshotReader
  openOrders?: OpenOrdersSnapshotReader
  tradeHistory?: TradeHistoryReader
  // The account dock never exercises order validation/preview, so tests pass the
  // place/cancel/modify surface only; `buildVenue` completes the `Trader` port
  // with no-op validate/preview stubs (ADR-0035 made them mandatory).
  trader?: Omit<Trader, 'validateDraft' | 'previewOrder'>
  positionProtection?: PositionProtection
  connection?: ConnectionStatusSource
}

function completeTrader(trader: Omit<Trader, 'validateDraft' | 'previewOrder'>): Trader {
  return {
    ...trader,
    validateDraft: () => err([{ message: 'not exercised by the account dock' }]),
    previewOrder: () => ({
      estimates: { kind: 'linear', notional: 0, margin: 0, liquidationPrice: 0, fee: 0, hasBuilderFee: false },
      capacity: { maxCoinSize: 0 },
    }),
  }
}

function buildVenue(overrides: VenueOverrides = {}): Venue {
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: overrides.connection ?? { status: () => 'connected', subscribe: () => () => {} },
      perpsPositionsSnapshot: overrides.positions,
      openOrdersSnapshot: overrides.openOrders,
      tradeHistory: overrides.tradeHistory,
      trader: overrides.trader === undefined ? undefined : completeTrader(overrides.trader),
      positionProtection: overrides.positionProtection,
    },
  }
}

function buildSpectate(overrides: Partial<SpectateContextValue> = {}): SpectateContextValue {
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

function buildWrapper(venue: Venue, spectate: SpectateContextValue = buildSpectate()) {
  return ({ children }: { children: ReactNode }) =>
    createElement(
      SpectateContext.Provider,
      { value: spectate },
      createElement(VenueContext.Provider, { value: venue }, children),
    )
}

describe('useAccountDock', () => {
  describe('tab list', () => {
    it('exposes the nine account tabs in the canonical order', () => {
      const tabValues = DOCK_TABS.map((tab) => tab.value)
      expect(tabValues).toEqual([
        'balances',
        'positions',
        'openOrders',
        'twap',
        'tradeHistory',
        'fundingHistory',
        'orderHistory',
        'interestHistory',
        'accountActivity',
      ])
    })

    it('labels the renamed Trade History tab', () => {
      const tradeHistoryTab = DOCK_TABS.find((tab) => tab.value === 'tradeHistory')
      expect(tradeHistoryTab?.label).toBe('Trade History')
    })
  })

  describe('capability gating', () => {
    it('reports hasPositions/hasOpenOrders/hasTradeHistory/hasTrader from venue capabilities', () => {
      const venue = buildVenue({
        positions: { subscribe: () => () => {} },
        openOrders: { subscribe: () => () => {} },
        trader: {
          placeOrder: () =>
            okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
          cancelOrder: () => okAsync(undefined),
        },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      expect(result.current.hasPositions).toBe(true)
      expect(result.current.hasOpenOrders).toBe(true)
      expect(result.current.hasTradeHistory).toBe(false)
      expect(result.current.hasTrader).toBe(true)
    })

    it('flags every cap as missing for a bare venue', () => {
      const venue = buildVenue()
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      expect(result.current.hasPositions).toBe(false)
      expect(result.current.hasOpenOrders).toBe(false)
      expect(result.current.hasTradeHistory).toBe(false)
      expect(result.current.hasTrader).toBe(false)
    })
  })

  describe('tab switching', () => {
    it('starts on positions tab', () => {
      const venue = buildVenue()
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      expect(result.current.activeTab).toBe('positions')
    })

    it('switches tab on setActiveTab', () => {
      const venue = buildVenue()
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      act(() => result.current.setActiveTab('openOrders'))
      expect(result.current.activeTab).toBe('openOrders')
    })

    it('subscribes to each snapshot cap exactly once regardless of tab switches', () => {
      const subscribePositions = vi.fn(() => () => {})
      const subscribeOrders = vi.fn(() => () => {})
      const subscribeFills = vi.fn(() => () => {})
      const venue = buildVenue({
        positions: { subscribe: subscribePositions },
        openOrders: { subscribe: subscribeOrders },
        tradeHistory: { subscribe: subscribeFills, loadOlder: () => okAsync({ exhausted: true }) },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      act(() => result.current.setActiveTab('openOrders'))
      act(() => result.current.setActiveTab('tradeHistory'))
      act(() => result.current.setActiveTab('positions'))
      expect(subscribePositions).toHaveBeenCalledTimes(1)
      expect(subscribeOrders).toHaveBeenCalledTimes(1)
      expect(subscribeFills).toHaveBeenCalledTimes(1)
    })
  })

  describe('positions snapshot', () => {
    it('replaces the entire positions array on each emission', () => {
      let cb: ((p: ReadonlyArray<PerpPositionSnapshot>) => void) | null = null
      const venue = buildVenue({
        positions: {
          subscribe: (next) => {
            cb = next
            return () => {}
          },
        },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      expect(result.current.positions).toEqual([])
      act(() => { cb!([MOCK_POSITION]) })
      expect(result.current.positions).toEqual([MOCK_POSITION])
      const updated = { ...MOCK_POSITION, markPrice: 52000, unrealizedPnlUsd: 2000 }
      act(() => { cb!([updated]) })
      expect(result.current.positions).toEqual([updated])
      act(() => { cb!([]) })
      expect(result.current.positions).toEqual([])
    })
  })

  describe('open orders snapshot', () => {
    it('replaces the entire orders array on each emission', () => {
      let cb: ((o: ReadonlyArray<Order>) => void) | null = null
      const venue = buildVenue({
        openOrders: {
          subscribe: (next) => {
            cb = next
            return () => {}
          },
        },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      expect(result.current.orders).toEqual([])
      act(() => { cb!([MOCK_ORDER]) })
      expect(result.current.orders).toEqual([MOCK_ORDER])
      act(() => { cb!([]) })
      expect(result.current.orders).toEqual([])
    })
  })

  describe('snapshot readiness (ADR-0036)', () => {
    it('reports positions loading until the first emission, then loaded (even when empty)', () => {
      let cb: ((p: ReadonlyArray<PerpPositionSnapshot>) => void) | null = null
      const venue = buildVenue({
        positions: {
          subscribe: (next) => {
            cb = next
            return () => {}
          },
        },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      // Before the first emission the snapshot is in flight — show the skeleton.
      expect(result.current.arePositionsLoading).toBe(true)
      // The first emission is the loaded signal, even when it carries zero rows.
      act(() => { cb!([]) })
      expect(result.current.arePositionsLoading).toBe(false)
    })

    it('reports open orders loading until the first emission', () => {
      let cb: ((o: ReadonlyArray<Order>) => void) | null = null
      const venue = buildVenue({
        openOrders: {
          subscribe: (next) => {
            cb = next
            return () => {}
          },
        },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      expect(result.current.areOpenOrdersLoading).toBe(true)
      act(() => { cb!([MOCK_ORDER]) })
      expect(result.current.areOpenOrdersLoading).toBe(false)
    })

    it('is never loading when the venue lacks the snapshot cap', () => {
      const venue = buildVenue()
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      expect(result.current.arePositionsLoading).toBe(false)
      expect(result.current.areOpenOrdersLoading).toBe(false)
      expect(result.current.areTwapsLoading).toBe(false)
    })
  })

  describe('trade history (paged)', () => {
    it('subscribes and triggers loadOlder once on first mount of a reader', async () => {
      const loadOlder = vi.fn(() => okAsync({ exhausted: false }))
      const venue = buildVenue({
        tradeHistory: { subscribe: () => () => {}, loadOlder },
      })
      renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      await waitFor(() => expect(loadOlder).toHaveBeenCalledTimes(1))
    })

    it('exposes loadOlderFills for paging further back; respects in-flight + exhausted', async () => {
      const loadOlder = vi.fn(() => okAsync({ exhausted: false }))
      const venue = buildVenue({
        tradeHistory: { subscribe: () => () => {}, loadOlder },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      // Wait for the bootstrap loadOlder to fully settle before triggering another.
      await waitFor(() => expect(result.current.isLoadingOlderFills).toBe(false))
      expect(loadOlder).toHaveBeenCalledTimes(1)
      await act(async () => { result.current.loadOlderFills() })
      expect(loadOlder).toHaveBeenCalledTimes(2)
    })

    it('re-bootstraps loadOlder when the venue first reaches connected (first-connect race)', async () => {
      // The bug: the bootstrap fires before Privy resolves the address, so the
      // tab stays empty until a page switch remounts the dock. A fresh
      // `connected` transition must re-run the (empty) bootstrap.
      const loadOlder = vi.fn(() => okAsync({ exhausted: false }))
      let emitStatus: ((status: ConnectionStatus) => void) | null = null
      const venue = buildVenue({
        tradeHistory: { subscribe: () => () => {}, loadOlder },
        connection: {
          status: () => 'connecting',
          subscribe: (onChange) => {
            emitStatus = onChange
            return () => {}
          },
        },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      await waitFor(() => expect(result.current.isLoadingOlderFills).toBe(false))
      expect(loadOlder).toHaveBeenCalledTimes(1)

      await act(async () => { emitStatus!('connected') })
      expect(loadOlder).toHaveBeenCalledTimes(2)
    })

    it('re-bootstraps history when the spectated account changes, even with rows loaded', async () => {
      // Spectating a new wallet re-keys the streams; the connect that follows the
      // address swap must re-run loadOlder so the dock drops user A's rows and
      // fetches user B's — the bug behind "account activity not updating".
      const loadOlder = vi.fn(() => okAsync({ exhausted: false }))
      let fillsCb: ((f: ReadonlyArray<Fill>) => void) | null = null
      let emitStatus: ((status: ConnectionStatus) => void) | null = null
      const venue = buildVenue({
        tradeHistory: {
          subscribe: (next) => {
            fillsCb = next
            return () => {}
          },
          loadOlder,
        },
        connection: {
          status: () => 'connected',
          subscribe: (onChange) => {
            emitStatus = onChange
            return () => {}
          },
        },
      })
      const { rerender } = renderHook(
        ({ reloadKey }: { reloadKey: string }) => useAccountDock(reloadKey),
        { wrapper: buildWrapper(venue), initialProps: { reloadKey: '0xaaa' } },
      )
      await waitFor(() => expect(loadOlder).toHaveBeenCalledTimes(1))
      act(() => { fillsCb!([MOCK_FILL]) }) // user A has paged-in rows

      rerender({ reloadKey: '0xbbb' }) // spectate a different wallet
      await act(async () => { emitStatus!('connected') }) // re-keyed stream reconnects
      expect(loadOlder).toHaveBeenCalledTimes(2)
    })

    it('does not re-bootstrap on a same-account reconnect once rows are loaded', async () => {
      // The flip side: a mid-session reconnect of the *same* wallet must not reset
      // a user who has paged back through history.
      const loadOlder = vi.fn(() => okAsync({ exhausted: false }))
      let fillsCb: ((f: ReadonlyArray<Fill>) => void) | null = null
      let emitStatus: ((status: ConnectionStatus) => void) | null = null
      const venue = buildVenue({
        tradeHistory: {
          subscribe: (next) => {
            fillsCb = next
            return () => {}
          },
          loadOlder,
        },
        connection: {
          status: () => 'connected',
          subscribe: (onChange) => {
            emitStatus = onChange
            return () => {}
          },
        },
      })
      renderHook(({ reloadKey }: { reloadKey: string }) => useAccountDock(reloadKey), {
        wrapper: buildWrapper(venue),
        initialProps: { reloadKey: '0xaaa' },
      })
      await waitFor(() => expect(loadOlder).toHaveBeenCalledTimes(1))
      act(() => { fillsCb!([MOCK_FILL]) })

      await act(async () => { emitStatus!('connected') }) // same account reconnects
      expect(loadOlder).toHaveBeenCalledTimes(1)
    })

    it('marks isFillsExhausted when loadOlder reports exhausted', async () => {
      const loadOlder = vi.fn(() => okAsync({ exhausted: true }))
      const venue = buildVenue({
        tradeHistory: { subscribe: () => () => {}, loadOlder },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      await waitFor(() => expect(result.current.isFillsExhausted).toBe(true))
    })

    it('surfaces fillsHistoryError on loadOlder failure', async () => {
      const loadOlder = vi.fn(() => errAsync({ kind: 'network' as const }))
      const venue = buildVenue({
        tradeHistory: { subscribe: () => () => {}, loadOlder },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      await waitFor(() => expect(result.current.fillsHistoryError).toContain('Network error'))
    })

    it('emits fills array from subscribe', () => {
      let cb: ((f: ReadonlyArray<Fill>) => void) | null = null
      const venue = buildVenue({
        tradeHistory: {
          subscribe: (next) => {
            cb = next
            return () => {}
          },
          loadOlder: () => okAsync({ exhausted: true }),
        },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      act(() => { cb!([MOCK_FILL]) })
      expect(result.current.fills).toEqual([MOCK_FILL])
    })
  })

  describe('live-stream contract', () => {
    // Why: the bug behind "websockets don't work in the account dock" is
    // always one of two things — either the dock gates on first-frame data
    // (so a quiet stream looks broken) or the subscription leaks across a
    // venue swap (so a fresh login sees stale rows). Lock both down.

    it('renders rows that arrive after subscribe returns (no first-frame gating)', async () => {
      // Realistic websocket flow: subscribe resolves synchronously, but the
      // first tick lands on a microtask. The dock must update — not stay on
      // the initial empty array because the cap was "quiet" at mount.
      let positionsCb: ((p: ReadonlyArray<PerpPositionSnapshot>) => void) | null = null
      let ordersCb: ((o: ReadonlyArray<Order>) => void) | null = null
      let fillsCb: ((f: ReadonlyArray<Fill>) => void) | null = null
      const venue = buildVenue({
        positions: {
          subscribe: (next) => {
            positionsCb = next
            return () => {}
          },
        },
        openOrders: {
          subscribe: (next) => {
            ordersCb = next
            return () => {}
          },
        },
        tradeHistory: {
          subscribe: (next) => {
            fillsCb = next
            return () => {}
          },
          loadOlder: () => okAsync({ exhausted: true }),
        },
      })

      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      expect(result.current.positions).toEqual([])
      expect(result.current.orders).toEqual([])
      expect(result.current.fills).toEqual([])

      // Three independent late ticks — one per cap. Each must flow through.
      await act(async () => {
        await Promise.resolve()
        positionsCb!([MOCK_POSITION])
        ordersCb!([MOCK_ORDER])
        fillsCb!([MOCK_FILL])
      })

      expect(result.current.positions).toEqual([MOCK_POSITION])
      expect(result.current.orders).toEqual([MOCK_ORDER])
      expect(result.current.fills).toEqual([MOCK_FILL])
    })

    it('invokes every cap unsubscribe exactly once on unmount (no stream leak across venue swap)', () => {
      const unsubPositions = vi.fn()
      const unsubOrders = vi.fn()
      const unsubFills = vi.fn()
      const venue = buildVenue({
        positions: { subscribe: () => unsubPositions },
        openOrders: { subscribe: () => unsubOrders },
        tradeHistory: { subscribe: () => unsubFills, loadOlder: () => okAsync({ exhausted: true }) },
      })

      const { unmount } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      expect(unsubPositions).not.toHaveBeenCalled()
      expect(unsubOrders).not.toHaveBeenCalled()
      expect(unsubFills).not.toHaveBeenCalled()

      unmount()

      expect(unsubPositions).toHaveBeenCalledTimes(1)
      expect(unsubOrders).toHaveBeenCalledTimes(1)
      expect(unsubFills).toHaveBeenCalledTimes(1)
    })
  })

  describe('cancelOrder', () => {
    it('calls trader.cancelOrder with the identifier when the cap is present', async () => {
      const cancelOrder = vi.fn(() => okAsync(undefined))
      const venue = buildVenue({
        trader: {
          placeOrder: () =>
            okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
          cancelOrder,
        },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      await act(async () => { result.current.cancelOrder('order-1') })
      expect(cancelOrder).toHaveBeenCalledWith('order-1')
    })

    it('sets cancelError when cancelOrder fails', async () => {
      const { CancelOrderError } = await import('../../../../shared/domain')
      const cancelOrder = vi.fn(() => errAsync(new CancelOrderError('not-found', 'not found')))
      const venue = buildVenue({
        trader: {
          placeOrder: () =>
            okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
          cancelOrder,
        },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      await act(async () => { result.current.cancelOrder('bad-id') })
      expect(result.current.cancelError).toBeTruthy()
    })

    it('sets cancelError synchronously when the trader cap is missing', () => {
      const venue = buildVenue()
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      act(() => result.current.cancelOrder('order-1'))
      expect(result.current.cancelError).toContain('not supported')
    })
  })

  describe('closePosition (full market, reduce-only)', () => {
    it('places a reduce-only opposite-side market order for the full size', async () => {
      let positionsCb: ((p: ReadonlyArray<PerpPositionSnapshot>) => void) | null = null
      const placeOrder = vi.fn(() =>
        okAsync({
          kind: 'filled' as const,
          orderIdentifier: 'x',
          symbol: 'BTC-PERP',
          averagePrice: 51000,
          filledSize: 1,
          timestamp: 1,
        }),
      )
      const venue = buildVenue({
        positions: {
          subscribe: (next) => {
            positionsCb = next
            return () => {}
          },
        },
        trader: { placeOrder, cancelOrder: () => okAsync(undefined) },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      act(() => { positionsCb!([MOCK_POSITION]) })
      await act(async () => { result.current.closePosition('BTC-PERP') })
      expect(placeOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          orderType: 'market',
          symbol: 'BTC-PERP',
          side: 'sell',
          size: 1,
          reduceOnly: true,
        }),
      )
    })

    it('is a no-op when the symbol has no open position', async () => {
      const placeOrder = vi.fn(() =>
        okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
      )
      const venue = buildVenue({
        positions: { subscribe: () => () => {} },
        trader: { placeOrder, cancelOrder: () => okAsync(undefined) },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      await act(async () => { result.current.closePosition('ETH-PERP') })
      expect(placeOrder).not.toHaveBeenCalled()
    })
  })

  describe('spectating lockout', () => {
    function buildFullTraderVenue() {
      return buildVenue({
        positions: { subscribe: () => () => {} },
        openOrders: { subscribe: () => () => {} },
        trader: {
          placeOrder: () =>
            okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
          cancelOrder: () => okAsync(undefined),
          modifyOrder: () =>
            okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
        },
        positionProtection: { setProtection: () => okAsync(undefined), clearProtection: () => okAsync(undefined) },
      })
    }

    it('hides every row action affordance while spectating', () => {
      const venue = buildFullTraderVenue()
      const { result } = renderHook(() => useAccountDock(), {
        wrapper: buildWrapper(venue, buildSpectate({ isSpectating: true })),
      })
      expect(result.current.hasTrader).toBe(false)
      expect(result.current.hasModifyOrder).toBe(false)
      expect(result.current.hasPositionProtection).toBe(false)
    })

    it('forbids sharing while spectating (cannot share the viewed account PnL)', () => {
      const venue = buildFullTraderVenue()
      const { result } = renderHook(() => useAccountDock(), {
        wrapper: buildWrapper(venue, buildSpectate({ isSpectating: true })),
      })
      expect(result.current.canShare).toBe(false)
    })

    it('exposes the action affordances when not spectating', () => {
      const venue = buildFullTraderVenue()
      const { result } = renderHook(() => useAccountDock(), {
        wrapper: buildWrapper(venue, buildSpectate({ isSpectating: false })),
      })
      expect(result.current.hasTrader).toBe(true)
      expect(result.current.hasModifyOrder).toBe(true)
      expect(result.current.hasPositionProtection).toBe(true)
      expect(result.current.canShare).toBe(true)
    })
  })

  describe('bulk actions', () => {
    function buildTraderVenue(spies: { cancelOrder: Trader['cancelOrder']; placeOrder: Trader['placeOrder'] }) {
      let positionsCb: ((p: ReadonlyArray<PerpPositionSnapshot>) => void) | null = null
      let ordersCb: ((o: ReadonlyArray<Order>) => void) | null = null
      const venue = buildVenue({
        positions: {
          subscribe: (next) => {
            positionsCb = next
            return () => {}
          },
        },
        openOrders: {
          subscribe: (next) => {
            ordersCb = next
            return () => {}
          },
        },
        trader: { placeOrder: spies.placeOrder, cancelOrder: spies.cancelOrder },
      })
      return {
        venue,
        emitPositions: (p: ReadonlyArray<PerpPositionSnapshot>) => positionsCb!(p),
        emitOrders: (o: ReadonlyArray<Order>) => ordersCb!(o),
      }
    }

    it('does not open the confirm when there is nothing to act on', () => {
      const { venue } = buildTraderVenue({
        cancelOrder: () => okAsync(undefined),
        placeOrder: () => okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      act(() => result.current.requestCancelAll())
      expect(result.current.pendingBulkAction).toBeNull()
    })

    it('opens the confirm then fans out cancelOrder over every order', async () => {
      const cancelOrder = vi.fn(() => okAsync(undefined))
      const harness = buildTraderVenue({
        cancelOrder,
        placeOrder: () => okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(harness.venue) })
      act(() => { harness.emitOrders([MOCK_ORDER, { ...MOCK_ORDER, identifier: 'order-2' }]) })
      act(() => result.current.requestCancelAll())
      expect(result.current.pendingBulkAction).toBe('cancel-all')
      expect(result.current.bulkActionCount).toBe(2)
      await act(async () => { result.current.confirmBulkAction() })
      expect(cancelOrder).toHaveBeenCalledTimes(2)
      expect(result.current.pendingBulkAction).toBeNull()
    })

    it('fans out a reduce-only market close over every position on close-all', async () => {
      const placeOrder = vi.fn(() =>
        okAsync({ kind: 'filled' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', averagePrice: 1, filledSize: 1, timestamp: 1 }),
      )
      const harness = buildTraderVenue({ cancelOrder: () => okAsync(undefined), placeOrder })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(harness.venue) })
      act(() => {
        harness.emitPositions([
          MOCK_POSITION,
          { ...MOCK_POSITION, symbol: 'ETH-PERP' },
        ])
      })
      act(() => result.current.requestCloseAll())
      await act(async () => { result.current.confirmBulkAction() })
      expect(placeOrder).toHaveBeenCalledTimes(2)
      expect(placeOrder).toHaveBeenCalledWith(
        expect.objectContaining({ reduceOnly: true, orderType: 'market' }),
      )
    })

    it('dismisses the confirm without acting', () => {
      const cancelOrder = vi.fn(() => okAsync(undefined))
      const harness = buildTraderVenue({
        cancelOrder,
        placeOrder: () => okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(harness.venue) })
      act(() => { harness.emitOrders([MOCK_ORDER]) })
      act(() => result.current.requestCancelAll())
      act(() => result.current.dismissBulkAction())
      expect(result.current.pendingBulkAction).toBeNull()
      expect(cancelOrder).not.toHaveBeenCalled()
    })

    describe('toolbarAction (Close-all / Cancel-all rendered inline with the tab strip)', () => {
      it('is null on the default (positions) tab before the snapshot loads', () => {
        const harness = buildTraderVenue({
          cancelOrder: () => okAsync(undefined),
          placeOrder: () => okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
        })
        const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(harness.venue) })
        expect(result.current.toolbarAction).toBeNull()
      })

      it('exposes Close-all once positions have loaded on the positions tab', () => {
        const harness = buildTraderVenue({
          cancelOrder: () => okAsync(undefined),
          placeOrder: () => okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
        })
        const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(harness.venue) })
        act(() => { harness.emitPositions([MOCK_POSITION]) })
        expect(result.current.toolbarAction).toEqual(
          expect.objectContaining({ label: 'Close all', ariaLabel: 'Close all positions' }),
        )
        act(() => result.current.toolbarAction?.onClick())
        expect(result.current.pendingBulkAction).toBe('close-all')
      })

      it('exposes Cancel-all once orders have loaded on the open-orders tab', () => {
        const harness = buildTraderVenue({
          cancelOrder: () => okAsync(undefined),
          placeOrder: () => okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
        })
        const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(harness.venue) })
        act(() => result.current.setActiveTab('openOrders'))
        act(() => { harness.emitOrders([MOCK_ORDER]) })
        expect(result.current.toolbarAction).toEqual(
          expect.objectContaining({ label: 'Cancel all', ariaLabel: 'Cancel all orders' }),
        )
        act(() => result.current.toolbarAction?.onClick())
        expect(result.current.pendingBulkAction).toBe('cancel-all')
      })

      it('is null on the positions tab once loaded with zero rows', () => {
        const harness = buildTraderVenue({
          cancelOrder: () => okAsync(undefined),
          placeOrder: () => okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
        })
        const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(harness.venue) })
        act(() => { harness.emitPositions([]) })
        expect(result.current.toolbarAction).toBeNull()
      })

      it('is null on a tab with no bulk action even when positions are loaded', () => {
        const harness = buildTraderVenue({
          cancelOrder: () => okAsync(undefined),
          placeOrder: () => okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
        })
        const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(harness.venue) })
        act(() => { harness.emitPositions([MOCK_POSITION]) })
        act(() => result.current.setActiveTab('tradeHistory'))
        expect(result.current.toolbarAction).toBeNull()
      })
    })
  })

  describe('modifyOrder', () => {
    it('reports hasModifyOrder only when the trader exposes modifyOrder', () => {
      const withModify = buildVenue({
        trader: {
          placeOrder: () =>
            okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
          cancelOrder: () => okAsync(undefined),
          modifyOrder: () =>
            okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
        },
      })
      const without = buildVenue({
        trader: {
          placeOrder: () =>
            okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
          cancelOrder: () => okAsync(undefined),
        },
      })
      const a = renderHook(() => useAccountDock(), { wrapper: buildWrapper(withModify) })
      const b = renderHook(() => useAccountDock(), { wrapper: buildWrapper(without) })
      expect(a.result.current.hasModifyOrder).toBe(true)
      expect(b.result.current.hasModifyOrder).toBe(false)
    })

    it('forwards submitModify to trader.modifyOrder', async () => {
      const modifyOrder = vi.fn(() =>
        okAsync({ kind: 'resting' as const, orderIdentifier: 'order-1', symbol: 'BTC-PERP', timestamp: 1 }),
      )
      const venue = buildVenue({
        trader: {
          placeOrder: () =>
            okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
          cancelOrder: () => okAsync(undefined),
          modifyOrder,
        },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      const request = { identifier: 'order-1', price: 51000, size: 2 }
      await act(async () => { result.current.submitModify(request, 'BTC-PERP') })
      expect(modifyOrder).toHaveBeenCalledWith(request)
    })

    it('opens and closes the modify dialog state', () => {
      const venue = buildVenue({
        trader: {
          placeOrder: () =>
            okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
          cancelOrder: () => okAsync(undefined),
          modifyOrder: () =>
            okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
        },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      expect(result.current.modifiedOrder).toBeNull()
      act(() => result.current.openModify(MOCK_ORDER))
      expect(result.current.modifiedOrder).toEqual(MOCK_ORDER)
      act(() => result.current.closeModify())
      expect(result.current.modifiedOrder).toBeNull()
    })
  })

  describe('position protection (Edit TP/SL)', () => {
    it('reports hasPositionProtection from the venue capability', () => {
      const withProtection = buildVenue({
        positionProtection: { setProtection: () => okAsync(undefined), clearProtection: () => okAsync(undefined) },
      })
      const without = buildVenue()
      const a = renderHook(() => useAccountDock(), { wrapper: buildWrapper(withProtection) })
      const b = renderHook(() => useAccountDock(), { wrapper: buildWrapper(without) })
      expect(a.result.current.hasPositionProtection).toBe(true)
      expect(b.result.current.hasPositionProtection).toBe(false)
    })

    it('forwards submitProtection to the capability', async () => {
      const setProtection = vi.fn(() => okAsync(undefined))
      const venue = buildVenue({
        positionProtection: { setProtection, clearProtection: () => okAsync(undefined) },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      const legs = { takeProfit: { kind: 'take-profit' as const, trigger: { type: 'price' as const, price: 70000 } } }
      await act(async () => { result.current.submitProtection('BTC-PERP', legs) })
      expect(setProtection).toHaveBeenCalledWith('BTC-PERP', legs)
    })

    it('forwards clearProtection to the capability', async () => {
      const clearProtection = vi.fn(() => okAsync(undefined))
      const venue = buildVenue({
        positionProtection: { setProtection: () => okAsync(undefined), clearProtection },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      await act(async () => { result.current.clearProtection('BTC-PERP') })
      expect(clearProtection).toHaveBeenCalledWith('BTC-PERP')
    })

    it('opens and closes the protection dialog state', () => {
      const venue = buildVenue({
        positionProtection: { setProtection: () => okAsync(undefined), clearProtection: () => okAsync(undefined) },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      expect(result.current.protectionPosition).toBeNull()
      act(() => result.current.openProtection(MOCK_POSITION))
      expect(result.current.protectionPosition).toEqual(MOCK_POSITION)
      act(() => result.current.closeProtection())
      expect(result.current.protectionPosition).toBeNull()
    })
  })

  describe('manage dialog state', () => {
    it('opens and closes the managed-position dialog state', () => {
      const venue = buildVenue({
        trader: {
          placeOrder: () =>
            okAsync({ kind: 'resting' as const, orderIdentifier: 'x', symbol: 'BTC-PERP', timestamp: 1 }),
          cancelOrder: () => okAsync(undefined),
        },
      })
      const { result } = renderHook(() => useAccountDock(), { wrapper: buildWrapper(venue) })
      expect(result.current.managedPosition).toBeNull()
      act(() => result.current.openManage(MOCK_POSITION))
      expect(result.current.managedPosition).toEqual(MOCK_POSITION)
      act(() => result.current.closeManage())
      expect(result.current.managedPosition).toBeNull()
    })
  })
})
