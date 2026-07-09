import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMockVenue } from '../create-mock-venue'
import type {
  Fill,
  Order,
  Position,
  TradesUpdate,
  OrderbookUpdate,
  ConnectionStatus,
} from '../../../shared/domain'

describe('createMockVenue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('capability shape', () => {
    it('exposes metadata.id "mock"', () => {
      const venue = createMockVenue()
      expect(venue.metadata.id).toBe('mock')
    })

    it('exposes mandatory connection capability', () => {
      const venue = createMockVenue()
      expect(venue.capabilities.connection).toBeDefined()
    })

    it('exposes portfolio, marketData, trader, candles, equityExtensions, feeSchedule, balances capabilities', () => {
      const venue = createMockVenue()
      const caps = venue.capabilities
      expect(caps.portfolio).toBeDefined()
      expect(caps.marketData).toBeDefined()
      expect(caps.trader).toBeDefined()
      expect(caps.candles).toBeDefined()
      expect(caps.equityExtensions).toBeDefined()
      expect(caps.feeSchedule).toBeDefined()
      expect(caps.balances).toBeDefined()
      expect(caps.positions).toBeDefined()
      expect(caps.openOrders).toBeDefined()
      expect(caps.fills).toBeDefined()
    })

    // Task 19: the mock venue must declare AND implement all four trading
    // capabilities so every optional-UI branch is exercisable in tests/dev.
    it('declares all four trading capabilities', () => {
      const caps = createMockVenue().capabilities
      expect(caps.trader).toBeDefined()
      expect(caps.leverageController).toBeDefined()
      expect(caps.marginModeController).toBeDefined()
      expect(caps.positionProtection).toBeDefined()
    })

    // ADR-0052 / ADR-0053: the mock venue stubs the TWAP management caps so the
    // panel's Active cancel + Fill History sub-tab are exercisable offline.
    it('declares the twapController and twapSliceFills caps', () => {
      const caps = createMockVenue().capabilities
      expect(caps.twapController).toBeDefined()
      expect(caps.twapSliceFills).toBeDefined()
    })

    it('twapController.cancelTwap and cancelAll resolve ok (no-op stub)', async () => {
      const controller = createMockVenue().capabilities.twapController!
      const single = await controller.cancelTwap({
        identifier: '1',
        symbol: 'BTC',
        side: 'buy',
        size: 1,
        executedSize: 0,
        executedNotionalUsd: 0,
        durationMinutes: 30,
        reduceOnly: false,
        randomize: false,
        createdAt: 0,
      })
      expect(single.isOk()).toBe(true)
      const all = await controller.cancelAll([])
      expect(all.isOk()).toBe(true)
      if (all.isOk()) expect(all.value).toEqual([])
    })

    it('advertises trigger-order support on trader (drives the entry TP/SL section)', () => {
      const trader = createMockVenue().capabilities.trader!
      expect(trader.supportsTriggerOrders).toBe(true)
    })

    it('exposes the optional trader sub-actions (modifyOrder, cancelOrder)', () => {
      const trader = createMockVenue().capabilities.trader!
      expect(typeof trader.cancelOrder).toBe('function')
      expect(typeof trader.modifyOrder).toBe('function')
    })

    // ADR-0038 D-5: mock-venue has no address/spectate concept, so `ownAccount`
    // aliases the same readers the viewing capabilities use (acting === viewing).
    it('aliases ownAccount.accountMode onto the viewing accountMode reader', () => {
      const caps = createMockVenue().capabilities
      expect(caps.ownAccount?.accountMode).toBeDefined()
      expect(caps.ownAccount?.accountMode).toBe(caps.accountMode)
    })
  })

  describe('MarketDataReader.subscribeTrades', () => {
    it('emits one snapshot synchronously on subscribe, then only appends', () => {
      const venue = createMockVenue()
      const updates: TradesUpdate[] = []
      venue.capabilities.marketData!.subscribeOrderbook('BTC-PERP', () => {})
      const unsubscribe = venue.capabilities.marketData!.subscribeTrades('BTC-PERP', (u) =>
        updates.push(u),
      )

      // Synchronous snapshot = the readiness signal; empty until trades generate (ADR-0030).
      expect(updates[0]).toEqual({ kind: 'snapshot', trades: [] })

      vi.advanceTimersByTime(5000)

      const snapshots = updates.filter((u) => u.kind === 'snapshot')
      const everyTailIsAppend = updates.slice(1).every((u) => u.kind === 'append')
      expect(snapshots).toHaveLength(1)
      expect(everyTailIsAppend).toBe(true)
      unsubscribe()
    })
  })

  describe('MarketDataReader.subscribeMarkets', () => {
    it('emits the mock market list synchronously and returns a no-op unsubscribe', () => {
      const venue = createMockVenue()
      const received: number[] = []
      const unsubscribe = venue.capabilities.marketData!.subscribeMarkets((markets) => {
        received.push(markets.length)
      })
      expect(received).toHaveLength(1)
      expect(received[0]).toBeGreaterThan(0)
      expect(() => unsubscribe()).not.toThrow()
    })

    it('listMarkets returns a referentially stable snapshot', () => {
      const venue = createMockVenue()
      const first = venue.capabilities.marketData!.listMarkets()
      const second = venue.capabilities.marketData!.listMarkets()
      expect(first).toBe(second)
    })
  })

  describe('PortfolioReader', () => {
    it('subscribeSnapshot delivers extended fields', () => {
      const venue = createMockVenue()
      const portfolio = venue.capabilities.portfolio!
      let received = 0
      const unsubscribe = portfolio.subscribeSnapshot('all', (snapshot) => {
        received += 1
        expect(snapshot.spotEquity).toBeGreaterThan(0)
        expect(snapshot.perpsEquity).toBeGreaterThan(0)
        expect(snapshot.fourteenDayVolume).toBeGreaterThan(0)
      })
      expect(received).toBe(1)
      unsubscribe()
    })

    it('honours scope axis: perps scope hides spot equity', () => {
      const venue = createMockVenue()
      const portfolio = venue.capabilities.portfolio!
      let perpsSnapshotSpot: number | null = null
      const unsubscribe = portfolio.subscribeSnapshot('perps', (snapshot) => {
        perpsSnapshotSpot = snapshot.spotEquity
      })
      expect(perpsSnapshotSpot).toBe(0)
      unsubscribe()
    })

    it('getHistory supports AllTime window', async () => {
      const venue = createMockVenue()
      const portfolio = venue.capabilities.portfolio!
      const result = await portfolio.getHistory('accountValue', 'AllTime', 'all')
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value.length).toBeGreaterThan(0)
    })
  })

  describe('EquityExtensionsReader', () => {
    it('emits a venue-supplied list of buckets synchronously on subscribe', () => {
      const venue = createMockVenue()
      const equityExtensions = venue.capabilities.equityExtensions!
      let buckets: ReadonlyArray<{ key: string; label: string; amountUsd: number }> = []
      const unsubscribe = equityExtensions.subscribe('all', (next) => {
        buckets = next
      })
      expect(buckets.length).toBeGreaterThan(0)
      expect(buckets[0]).toMatchObject({ key: expect.any(String), label: expect.any(String) })
      unsubscribe()
    })
  })

  describe('FeeScheduleReader', () => {
    it('emits a fee schedule with tiers and a current tier key', () => {
      const venue = createMockVenue()
      const feeSchedule = venue.capabilities.feeSchedule!
      let captured: { tiers: ReadonlyArray<{ key: string }>; currentTierKey: string | null } | null = null
      const unsubscribe = feeSchedule.subscribe((next) => {
        captured = next
      })
      expect(captured).not.toBeNull()
      const schedule = captured as unknown as { tiers: ReadonlyArray<{ key: string }>; currentTierKey: string | null }
      expect(schedule.tiers.length).toBeGreaterThan(0)
      expect(schedule.currentTierKey).toBe('tier-1')
      unsubscribe()
    })
  })

  describe('BalancesReader', () => {
    it('emits a list of balances synchronously on subscribe', () => {
      const venue = createMockVenue()
      const balances = venue.capabilities.balances!
      let received: ReadonlyArray<{ asset: string }> = []
      const unsubscribe = balances.subscribe('all', (next) => {
        received = next
      })
      expect(received.length).toBeGreaterThan(0)
      unsubscribe()
    })
  })

  describe('ConnectionStatusSource', () => {
    it('emits current status synchronously on subscribe', () => {
      const venue = createMockVenue()
      const received: ConnectionStatus[] = []
      const unsubscribe = venue.capabilities.connection.subscribe((status) => received.push(status))
      expect(received).toEqual(['connected'])
      unsubscribe()
    })

    it('emits reconnecting then connected during a simulated disconnect cycle', () => {
      const venue = createMockVenue({ rng: () => 0 })
      const received: ConnectionStatus[] = []
      const unsubscribe = venue.capabilities.connection.subscribe((status) => received.push(status))

      vi.advanceTimersByTime(2 * 60 * 1000 + 1_000)
      expect(received).toContain('reconnecting')
      expect(received[received.length - 1]).toBe('connected')
      unsubscribe()
    })

    it('unsubscribing stops status callbacks', () => {
      const venue = createMockVenue({ rng: () => 0 })
      const received: ConnectionStatus[] = []
      const unsubscribe = venue.capabilities.connection.subscribe((status) => received.push(status))
      unsubscribe()
      received.length = 0
      vi.advanceTimersByTime(10 * 60 * 1000)
      expect(received).toHaveLength(0)
    })
  })

  describe('Leverage + margin mode controllers', () => {
    it('declares both controllers', () => {
      const venue = createMockVenue()
      expect(venue.capabilities.leverageController).toBeDefined()
      expect(venue.capabilities.marginModeController).toBeDefined()
    })

    it('setLeverage succeeds for a known market and rejects an unknown one', async () => {
      const venue = createMockVenue()
      const ok = await venue.capabilities.leverageController!.setLeverage('BTC-PERP', 10)
      const bad = await venue.capabilities.leverageController!.setLeverage('NOPE', 10)
      expect(ok.isOk()).toBe(true)
      expect(bad.isErr()).toBe(true)
    })

    it('setMarginMode succeeds for a known market', async () => {
      const venue = createMockVenue()
      const result = await venue.capabilities.marginModeController!.setMarginMode(
        'BTC-PERP',
        'isolated',
      )
      expect(result.isOk()).toBe(true)
    })
  })

  describe('Trader', () => {
    it('rejects placeOrder when size is not positive', async () => {
      const venue = createMockVenue()
      const result = await venue.capabilities.trader!.placeOrder({
        symbol: 'BTC-PERP',
        side: 'buy',
        size: 0,
        orderType: 'market',
      })
      expect(result.isErr()).toBe(true)
    })

    // ADR-0034 D-4: the mock advertises and minimally simulates the Pro types.
    it('advertises stop/TWAP support', () => {
      const venue = createMockVenue()
      expect(venue.capabilities.trader!.supportsStopOrders).toBe(true)
      expect(venue.capabilities.trader!.supportsTwap).toBe(true)
    })

    it('accepts stop-market as a resting trigger order reflected in the open-orders stream', async () => {
      const venue = createMockVenue()
      const orders: Order[] = []
      const unsubOrders = venue.capabilities.openOrders!.subscribe((o) => orders.push(o))

      const promise = venue.capabilities.trader!.placeOrder({
        symbol: 'BTC-PERP',
        side: 'buy',
        size: 0.5,
        orderType: 'stop-market',
        stopPrice: 60_000,
      })
      vi.advanceTimersByTime(150)
      const result = await promise

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.kind).toBe('resting')
        expect(result.value.symbol).toBe('BTC-PERP')
      }
      expect(orders.length).toBe(1)
      expect(orders[0].status).toBe('open')
      expect(orders[0].triggerConditions).toBe('Price ≥ 60000')
      // Stop-market fills at market on trigger; the recorded resting price is the stop price.
      expect(orders[0].price).toBe(60_000)
      unsubOrders()
    })

    it('accepts stop-limit and records the post-trigger resting price', async () => {
      const venue = createMockVenue()
      const orders: Order[] = []
      const unsubOrders = venue.capabilities.openOrders!.subscribe((o) => orders.push(o))

      const promise = venue.capabilities.trader!.placeOrder({
        symbol: 'BTC-PERP',
        side: 'sell',
        size: 0.5,
        orderType: 'stop-limit',
        stopPrice: 60_000,
        price: 59_900,
      })
      vi.advanceTimersByTime(150)
      const result = await promise

      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value.kind).toBe('resting')
      expect(orders.length).toBe(1)
      // Sell-side trigger comparator and the limit price as the resting price.
      expect(orders[0].triggerConditions).toBe('Price ≤ 60000')
      expect(orders[0].price).toBe(59_900)
      unsubOrders()
    })

    it('accepts twap and acknowledges it as a running (resting) order', async () => {
      const venue = createMockVenue()
      const promise = venue.capabilities.trader!.placeOrder({
        symbol: 'BTC-PERP',
        side: 'buy',
        size: 0.5,
        orderType: 'twap',
        durationMinutes: 30,
        randomize: true,
      })
      vi.advanceTimersByTime(150)
      const result = await promise

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.kind).toBe('resting')
        expect(result.value.symbol).toBe('BTC-PERP')
      }
    })

    it('rejects a stop-market with a non-positive stop price', async () => {
      const venue = createMockVenue()
      const result = await venue.capabilities.trader!.placeOrder({
        symbol: 'BTC-PERP',
        side: 'buy',
        size: 0.5,
        orderType: 'stop-market',
        stopPrice: 0,
      })
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('invalid-price')
    })

    it('rejects a twap with a non-positive duration', async () => {
      const venue = createMockVenue()
      const result = await venue.capabilities.trader!.placeOrder({
        symbol: 'BTC-PERP',
        side: 'buy',
        size: 0.5,
        orderType: 'twap',
        durationMinutes: 0,
        randomize: false,
      })
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('invalid-size')
    })

    it('returns an acknowledgement and a fill prints to trades stream', async () => {
      const venue = createMockVenue()
      const tradeUpdates: TradesUpdate[] = []
      const fills: Fill[] = []
      const orders: Order[] = []
      const positions: Position[] = []

      const unsubOrderbook = venue.capabilities.marketData!.subscribeOrderbook('BTC-PERP', () => {})
      const unsubTrades = venue.capabilities.marketData!.subscribeTrades('BTC-PERP', (u) => tradeUpdates.push(u))
      const unsubFills = venue.capabilities.fills!.subscribe((f) => fills.push(f))
      const unsubOrders = venue.capabilities.openOrders!.subscribe((o) => orders.push(o))
      const unsubPositions = venue.capabilities.positions!.subscribe((p) => positions.push(p))

      const resultPromise = venue.capabilities.trader!.placeOrder({
        symbol: 'BTC-PERP',
        side: 'buy',
        size: 0.5,
        orderType: 'market',
      })
      vi.advanceTimersByTime(150)
      const result = await resultPromise

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.orderIdentifier).toMatch(/^order-/)
        expect(result.value.symbol).toBe('BTC-PERP')
        expect(result.value.kind).toBe('filled')
        if (result.value.kind === 'filled') expect(result.value.filledSize).toBe(0.5)
      }
      // A market fill prints as an `append` after the synchronous initial snapshot (ADR-0030).
      const printedTrades = tradeUpdates.flatMap((u) => (u.kind === 'append' ? [u.trade] : []))
      expect(fills.length).toBe(1)
      expect(orders.length).toBe(1)
      expect(positions.length).toBe(1)
      expect(printedTrades.length).toBe(1)
      expect(printedTrades[0].size).toBe(0.5)

      unsubOrderbook()
      unsubTrades()
      unsubFills()
      unsubOrders()
      unsubPositions()
    })

    it('cancelOrder removes a resting limit so a subsequent cross does not fill it', async () => {
      const venue = createMockVenue()
      const fills: Fill[] = []
      const unsubOrderbook = venue.capabilities.marketData!.subscribeOrderbook('BTC-PERP', () => {})
      const unsubFills = venue.capabilities.fills!.subscribe((fill) => fills.push(fill))

      const placedPromise = venue.capabilities.trader!.placeOrder({
        symbol: 'BTC-PERP',
        side: 'buy',
        size: 1,
        price: 1,
        orderType: 'limit',
        timeInForce: 'Gtc',
      })
      vi.advanceTimersByTime(150)
      const placed = await placedPromise
      expect(placed.isOk()).toBe(true)
      const orderIdentifier = placed.isOk() ? placed.value.orderIdentifier : ''
      const cancelPromise = venue.capabilities.trader!.cancelOrder(orderIdentifier)
      vi.advanceTimersByTime(150)
      const cancelResult = await cancelPromise
      expect(cancelResult.isOk()).toBe(true)

      vi.advanceTimersByTime(1000)
      expect(fills.length).toBe(0)

      unsubOrderbook()
      unsubFills()
    })

    it('modifyOrder updates a resting limit price/size and re-emits the order', async () => {
      const venue = createMockVenue()
      const orders: Order[] = []
      const unsubOrderbook = venue.capabilities.marketData!.subscribeOrderbook('BTC-PERP', () => {})
      const unsubOrders = venue.capabilities.openOrders!.subscribe((o) => orders.push(o))

      const placedPromise = venue.capabilities.trader!.placeOrder({
        symbol: 'BTC-PERP',
        side: 'buy',
        size: 1,
        price: 1,
        orderType: 'limit',
        timeInForce: 'Gtc',
      })
      vi.advanceTimersByTime(150)
      const placed = await placedPromise
      const orderIdentifier = placed.isOk() ? placed.value.orderIdentifier : ''

      const modifyPromise = venue.capabilities.trader!.modifyOrder!({
        identifier: orderIdentifier,
        price: 2,
        size: 3,
      })
      vi.advanceTimersByTime(150)
      const modified = await modifyPromise

      expect(modified.isOk()).toBe(true)
      if (modified.isOk()) expect(modified.value.kind).toBe('resting')
      const latest = orders[orders.length - 1]
      expect(latest.price).toBe(2)
      expect(latest.size).toBe(3)

      unsubOrderbook()
      unsubOrders()
    })

    it('modifyOrder rejects an unknown order with kind not-found', async () => {
      const venue = createMockVenue()
      const result = await venue.capabilities.trader!.modifyOrder!({
        identifier: 'missing',
        price: 2,
      })
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('not-found')
    })

    it('modifyOrder rejects a non-positive size with kind invalid-size', async () => {
      const venue = createMockVenue()
      const unsubOrderbook = venue.capabilities.marketData!.subscribeOrderbook('BTC-PERP', () => {})
      const placedPromise = venue.capabilities.trader!.placeOrder({
        symbol: 'BTC-PERP',
        side: 'buy',
        size: 1,
        price: 1,
        orderType: 'limit',
        timeInForce: 'Gtc',
      })
      vi.advanceTimersByTime(150)
      const placed = await placedPromise
      const orderIdentifier = placed.isOk() ? placed.value.orderIdentifier : ''

      const result = await venue.capabilities.trader!.modifyOrder!({
        identifier: orderIdentifier,
        size: 0,
      })
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('invalid-size')
      unsubOrderbook()
    })
  })

  describe('Position protection (wired venue)', () => {
    it('rejects setProtection with no-position before any fill', async () => {
      const venue = createMockVenue()
      const result = await venue.capabilities.positionProtection!.setProtection('BTC-PERP', {
        takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 70_000 } },
      })
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('no-position')
    })

    it('records TP/SL once a market fill has opened a position, then clears it', async () => {
      const venue = createMockVenue()
      venue.capabilities.marketData!.subscribeOrderbook('BTC-PERP', () => {})

      const placePromise = venue.capabilities.trader!.placeOrder({
        symbol: 'BTC-PERP',
        side: 'buy',
        size: 0.5,
        orderType: 'market',
      })
      vi.advanceTimersByTime(150)
      const placed = await placePromise
      expect(placed.isOk()).toBe(true)

      const protection = venue.capabilities.positionProtection!
      const set = await protection.setProtection('BTC-PERP', {
        takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 70_000 } },
        stopLoss: { kind: 'stop-loss', trigger: { type: 'price', price: 50_000 } },
      })
      expect(set.isOk()).toBe(true)

      const cleared = await protection.clearProtection('BTC-PERP')
      expect(cleared.isOk()).toBe(true)
    })

    it('rejects setProtection for an unknown symbol', async () => {
      const venue = createMockVenue()
      const result = await venue.capabilities.positionProtection!.setProtection('NOPE', {
        takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 1 } },
      })
      expect(result.isErr()).toBe(true)
    })
  })

  describe('orderbook gating during reconnect', () => {
    it('does not emit diffs while reconnecting', () => {
      const venue = createMockVenue({ rng: () => 0 })
      const updates: OrderbookUpdate[] = []
      const unsubscribeOrderbook = venue.capabilities.marketData!.subscribeOrderbook('BTC-PERP', (update) =>
        updates.push(update),
      )

      vi.advanceTimersByTime(2 * 60 * 1000)
      const snapshotBeforeDisconnect = updates.filter((u) => u.kind === 'snapshot').length
      const totalBeforeDisconnect = updates.length

      updates.length = 0
      vi.advanceTimersByTime(500)
      const emittedDuringReconnect = updates.length
      expect(emittedDuringReconnect).toBe(0)

      vi.advanceTimersByTime(500)
      const snapshotAfterReconnect = updates.find((u) => u.kind === 'snapshot')
      expect(snapshotAfterReconnect).toBeDefined()

      void snapshotBeforeDisconnect
      void totalBeforeDisconnect

      unsubscribeOrderbook()
    })

    it('emits a fresh snapshot as first update after reconnect', () => {
      const venue = createMockVenue({ rng: () => 0 })
      const updates: OrderbookUpdate[] = []

      const unsubscribeOrderbook = venue.capabilities.marketData!.subscribeOrderbook('BTC-PERP', (update) =>
        updates.push(update),
      )

      vi.advanceTimersByTime(2 * 60 * 1000)
      updates.length = 0

      vi.advanceTimersByTime(1_000)
      const firstUpdate = updates[0]
      expect(firstUpdate?.kind).toBe('snapshot')

      unsubscribeOrderbook()
    })
  })

  describe('placeOrder and cancelOrder latency', () => {
    it('placeOrder ack is delayed by 50–150ms', async () => {
      const venue = createMockVenue()
      venue.capabilities.marketData!.subscribeOrderbook('BTC-PERP', () => {})

      let resolved = false
      const promise = venue.capabilities.trader!.placeOrder({
        symbol: 'BTC-PERP',
        side: 'buy',
        size: 0.5,
        orderType: 'market',
      }).then((result) => {
        resolved = true
        return result
      })

      expect(resolved).toBe(false)
      vi.advanceTimersByTime(49)
      expect(resolved).toBe(false)
      vi.advanceTimersByTime(101)
      await promise
      expect(resolved).toBe(true)
    })

    it('cancelOrder ack is delayed by 50–150ms', async () => {
      const venue = createMockVenue()
      venue.capabilities.marketData!.subscribeOrderbook('BTC-PERP', () => {})

      const placed = await (async () => {
        const p = venue.capabilities.trader!.placeOrder({
          symbol: 'BTC-PERP',
          side: 'buy',
          size: 0.5,
          price: 60_000,
          orderType: 'limit',
          timeInForce: 'Gtc',
        })
        vi.advanceTimersByTime(150)
        return p
      })()
      const orderIdentifier = placed.isOk() ? placed.value.orderIdentifier : ''

      let resolved = false
      const cancelPromise = venue.capabilities.trader!.cancelOrder(orderIdentifier).then((result) => {
        resolved = true
        return result
      })

      expect(resolved).toBe(false)
      vi.advanceTimersByTime(49)
      expect(resolved).toBe(false)
      vi.advanceTimersByTime(101)
      await cancelPromise
      expect(resolved).toBe(true)
    })
  })
})
