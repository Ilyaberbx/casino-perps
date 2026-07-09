import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { okAsync, errAsync, ResultAsync } from 'neverthrow'
import * as venueProvider from '../../../shared/providers/venue-provider'
import * as account from '@/modules/account'
import type {
  Venue,
  PortfolioReader,
  PortfolioSnapshot,
  PortfolioPoint,
  PortfolioMetric,
  PortfolioWindow,
} from '../../../shared/domain'
import { PortfolioHistoryError } from '../../../shared/domain'
import { usePortfolioPage } from '../use-portfolio-page'

// The page derives its reactive "viewed wallet" from these two account hooks
// (Selected Wallet → Privy primary). Tests don't mount the providers, so stub
// both: no selection, and an auth state whose only field the page reads is
// `primaryWalletAddress` (null here — fetch is gated on `isConnected`, not the
// address, so the existing fetch assertions stay valid).
const NO_SELECTED_WALLET: account.SelectedWalletView = {
  selectedAddress: null,
  masterAddress: null,
  nativeAddress: null,
  isSelectionConnectable: false,
}
const STUB_AUTH = { primaryWalletAddress: null } as unknown as account.AuthState

interface PortfolioOverrides {
  subscribeSnapshot?: PortfolioReader['subscribeSnapshot']
  getHistory?: PortfolioReader['getHistory']
}

function buildVenue(overrides: PortfolioOverrides = {}): Venue {
  const portfolio: PortfolioReader = {
    subscribeSnapshot: overrides.subscribeSnapshot ?? (() => () => {}),
    getHistory: overrides.getHistory ?? (() => okAsync([])),
  }
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      portfolio,
    },
  }
}

function buildPoints(seed: number): PortfolioPoint[] {
  return [
    { timestamp: seed * 1000, value: seed },
    { timestamp: seed * 1000 + 1, value: seed + 1 },
  ]
}

describe('usePortfolioPage', () => {
  const mockUnsubscribe = vi.fn()
  const mockSubscribe = vi.fn<PortfolioReader['subscribeSnapshot']>()

  beforeEach(() => {
    vi.clearAllMocks()
    mockSubscribe.mockReturnValue(mockUnsubscribe)
    vi.spyOn(venueProvider, 'useVenue').mockReturnValue(
      buildVenue({ subscribeSnapshot: mockSubscribe }),
    )
    vi.spyOn(account, 'useIsWalletConnected').mockReturnValue(true)
    vi.spyOn(account, 'useSelectedWallet').mockReturnValue(NO_SELECTED_WALLET)
    vi.spyOn(account, 'useAuth').mockReturnValue(STUB_AUTH)
  })

  it('subscribes on mount', () => {
    renderHook(() => usePortfolioPage())
    expect(mockSubscribe).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => usePortfolioPage())
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('exposes the latest snapshot', () => {
    let capturedCallback: ((s: PortfolioSnapshot) => void) | undefined
    mockSubscribe.mockImplementation((_scope, cb) => {
      capturedCallback = cb
      return mockUnsubscribe
    })
    const { result } = renderHook(() => usePortfolioPage())
    expect(result.current.snapshot).toBeNull()
    // Connected + portfolio capability present + no snapshot yet → loading.
    expect(result.current.isSnapshotLoading).toBe(true)
    const snapshot: PortfolioSnapshot = {
      accountValue: 10_000,
      pnl: { '24H': 100, '7D': 100, '30D': 100, AllTime: 100 },
      perpsPnl: 50,
      volume: { '24H': 250, '7D': 250, '30D': 250, AllTime: 250 },
      spotEquity: 4_000,
      perpsEquity: 6_000,
      fourteenDayVolume: 100_000,
      timestamp: 1,
    }
    act(() => {
      capturedCallback?.(snapshot)
    })
    expect(result.current.snapshot).toEqual(snapshot)
    expect(result.current.isSnapshotLoading).toBe(false)
  })

  it('defaults the Window selector to 24H', () => {
    const { result } = renderHook(() => usePortfolioPage())
    expect(result.current.window).toBe('24H')
  })

  it('defaults scope to all', () => {
    const { result } = renderHook(() => usePortfolioPage())
    expect(result.current.scope).toBe('all')
  })

  it('defaults chartMetric to pnl', () => {
    const { result } = renderHook(() => usePortfolioPage())
    expect(result.current.chartMetric).toBe('pnl')
  })

  it('setScope updates scope', () => {
    const { result } = renderHook(() => usePortfolioPage())
    act(() => {
      result.current.setScope('perps')
    })
    expect(result.current.scope).toBe('perps')
  })

  it('defaults isSegregated to true when the venue has no accountMode capability', () => {
    const { result } = renderHook(() => usePortfolioPage())
    expect(result.current.isSegregated).toBe(true)
  })

  it('reflects a unified account and forces scope back to all', () => {
    vi.spyOn(venueProvider, 'useVenue').mockReturnValue({
      metadata: { id: 'mock', label: 'Mock' },
      capabilities: {
        connection: { status: () => 'connected', subscribe: () => () => {} },
        portfolio: {
          subscribeSnapshot: mockSubscribe,
          getHistory: () => okAsync([]),
        },
        accountMode: {
          current: () => ({ isSegregated: false }),
          subscribe: (cb) => {
            cb({ isSegregated: false })
            return () => {}
          },
        },
      },
    })
    const { result } = renderHook(() => usePortfolioPage())
    expect(result.current.isSegregated).toBe(false)
    act(() => {
      result.current.setScope('perps')
    })
    // a unified account has no perps-only view — scope snaps back to all.
    expect(result.current.scope).toBe('all')
  })

  it('setChartMetric updates chartMetric', () => {
    const { result } = renderHook(() => usePortfolioPage())
    act(() => {
      result.current.setChartMetric('accountValue')
    })
    expect(result.current.chartMetric).toBe('accountValue')
  })

  it('starts each chart in loading then transitions to ready', async () => {
    const points: PortfolioPoint[] = buildPoints(1)
    const getHistory: PortfolioReader['getHistory'] = () => okAsync(points)
    vi.spyOn(venueProvider, 'useVenue').mockReturnValue(
      buildVenue({ subscribeSnapshot: mockSubscribe, getHistory }),
    )
    const { result } = renderHook(() => usePortfolioPage())
    expect(result.current.charts.accountValue.kind).toBe('loading')
    expect(result.current.charts.pnl.kind).toBe('loading')
    expect(result.current.charts.perpsPnl.kind).toBe('loading')

    await waitFor(() => {
      expect(result.current.charts.accountValue.kind).toBe('ready')
      expect(result.current.charts.pnl.kind).toBe('ready')
      expect(result.current.charts.perpsPnl.kind).toBe('ready')
    })
  })

  it('isolates per-chart errors', async () => {
    const failingMetric: PortfolioMetric = 'pnl'
    const ok1 = buildPoints(1)
    const getHistory: PortfolioReader['getHistory'] = (metric) => {
      if (metric === failingMetric) {
        return errAsync(new PortfolioHistoryError('unknown-metric', 'boom'))
      }
      return okAsync(ok1)
    }
    vi.spyOn(venueProvider, 'useVenue').mockReturnValue(
      buildVenue({ subscribeSnapshot: mockSubscribe, getHistory }),
    )
    const { result } = renderHook(() => usePortfolioPage())
    await waitFor(() => {
      expect(result.current.charts.accountValue.kind).toBe('ready')
      expect(result.current.charts.pnl.kind).toBe('error')
      expect(result.current.charts.perpsPnl.kind).toBe('ready')
    })
  })

  it('latest-wins on rapid Window changes', async () => {
    const pointsByWindow: Record<PortfolioWindow, PortfolioPoint[]> = {
      '24H': buildPoints(24),
      '7D': buildPoints(7),
      '30D': buildPoints(30),
      AllTime: buildPoints(99),
    }
    const resolvers: Array<() => void> = []
    const getHistory: PortfolioReader['getHistory'] = (_metric, window) => {
      return ResultAsync.fromPromise(
        new Promise<PortfolioPoint[]>((resolve) => {
          resolvers.push(() => resolve(pointsByWindow[window]))
        }),
        () => new PortfolioHistoryError('unknown-window', 'never'),
      )
    }
    vi.spyOn(venueProvider, 'useVenue').mockReturnValue(
      buildVenue({ subscribeSnapshot: mockSubscribe, getHistory }),
    )
    const { result } = renderHook(() => usePortfolioPage())
    // initial 3 calls (24H) pending
    const firstBatch = resolvers.splice(0, 3)
    act(() => {
      result.current.setWindow('7D')
    })
    const secondBatch = resolvers.splice(0, 3)
    act(() => {
      result.current.setWindow('30D')
    })
    const thirdBatch = resolvers.splice(0, 3)

    // resolve out of order: third first, then second, then first
    await act(async () => {
      thirdBatch.forEach((r) => r())
      await Promise.resolve()
    })
    await waitFor(() => {
      const state = result.current.charts.accountValue
      expect(state.kind).toBe('ready')
      if (state.kind === 'ready') expect(state.points).toEqual(pointsByWindow['30D'])
    })
    await act(async () => {
      secondBatch.forEach((r) => r())
      firstBatch.forEach((r) => r())
      await Promise.resolve()
    })
    // stale results must NOT overwrite the latest
    const finalState = result.current.charts.accountValue
    expect(finalState.kind).toBe('ready')
    if (finalState.kind === 'ready') {
      expect(finalState.points).toEqual(pointsByWindow['30D'])
    }
  })

  it('re-subscribes snapshot when scope changes', () => {
    let capturedScope: string | undefined
    mockSubscribe.mockImplementation((scope) => {
      capturedScope = scope
      return mockUnsubscribe
    })
    const { result } = renderHook(() => usePortfolioPage())
    expect(capturedScope).toBe('all')
    act(() => {
      result.current.setScope('perps')
    })
    expect(capturedScope).toBe('perps')
  })

  it('reports hasPortfolio true when venue has portfolio capability', () => {
    const { result } = renderHook(() => usePortfolioPage())
    expect(result.current.hasPortfolio).toBe(true)
  })

  it('reports hasPortfolio false when venue lacks portfolio capability', () => {
    vi.spyOn(venueProvider, 'useVenue').mockReturnValue({
      metadata: { id: 'mock', label: 'Mock' },
      capabilities: {
        connection: { status: () => 'connected', subscribe: () => () => {} },
      },
    })
    const { result } = renderHook(() => usePortfolioPage())
    expect(result.current.hasPortfolio).toBe(false)
  })

  describe('when wallet is disconnected', () => {
    beforeEach(() => {
      vi.spyOn(account, 'useIsWalletConnected').mockReturnValue(false)
    })

    it('exposes a zeroed snapshot regardless of venue values', () => {
      let capturedCallback: ((s: PortfolioSnapshot) => void) | undefined
      mockSubscribe.mockImplementation((_scope, cb) => {
        capturedCallback = cb
        return mockUnsubscribe
      })
      const { result } = renderHook(() => usePortfolioPage())
      act(() => {
        capturedCallback?.({
          accountValue: 999,
          pnl: { '24H': 50, '7D': 50, '30D': 50, AllTime: 50 },
          perpsPnl: 25,
          volume: { '24H': 1_000, '7D': 1_000, '30D': 1_000, AllTime: 1_000 },
          spotEquity: 100,
          perpsEquity: 200,
          fourteenDayVolume: 500,
          timestamp: 1,
        })
      })
      expect(result.current.snapshot).toEqual({
        accountValue: 0,
        pnl: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
        perpsPnl: 0,
        volume: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
        spotEquity: 0,
        perpsEquity: 0,
        fourteenDayVolume: 0,
        timestamp: 0,
      })
      // Disconnected is the wallet-gate empty state, never a loading skeleton.
      expect(result.current.isSnapshotLoading).toBe(false)
    })

    it('exposes flat-zero ready chart state for every metric (no loading, no venue call)', () => {
      const getHistory = vi.fn(
        () => okAsync([{ timestamp: 1, value: 999 }]) as never,
      ) as PortfolioReader['getHistory']
      vi.spyOn(venueProvider, 'useVenue').mockReturnValue(
        buildVenue({ subscribeSnapshot: mockSubscribe, getHistory }),
      )
      const { result } = renderHook(() => usePortfolioPage())

      const accountValue = result.current.charts.accountValue
      const pnl = result.current.charts.pnl
      const perpsPnl = result.current.charts.perpsPnl

      expect(accountValue.kind).toBe('ready')
      expect(pnl.kind).toBe('ready')
      expect(perpsPnl.kind).toBe('ready')
      if (accountValue.kind === 'ready') {
        expect(accountValue.points.length).toBeGreaterThan(0)
        expect(accountValue.points.every((p) => p.value === 0)).toBe(true)
      }
      expect(getHistory).not.toHaveBeenCalled()
    })

    it('updates the flat series when the user switches window', () => {
      const { result } = renderHook(() => usePortfolioPage())
      const beforePoints =
        result.current.charts.accountValue.kind === 'ready'
          ? result.current.charts.accountValue.points
          : []
      act(() => {
        result.current.setWindow('30D')
      })
      const afterPoints =
        result.current.charts.accountValue.kind === 'ready'
          ? result.current.charts.accountValue.points
          : []
      expect(afterPoints.every((p) => p.value === 0)).toBe(true)
      const beforeSpan = beforePoints[beforePoints.length - 1].timestamp - beforePoints[0].timestamp
      const afterSpan = afterPoints[afterPoints.length - 1].timestamp - afterPoints[0].timestamp
      expect(afterSpan).toBeGreaterThan(beforeSpan)
    })
  })
})
