import { useCallback, useEffect, useRef, useState } from 'react'
import { useIsWalletConnected, useSelectedWallet, useAuth } from '@/modules/account'
import { useSpectatedAddress } from '@/modules/spectate'
import { useVenue } from '../../shared/providers/venue-provider'
import type {
  PortfolioSnapshot,
  PortfolioWindow,
  PortfolioPoint,
  PortfolioHistoryError,
  PortfolioAccountScope,
} from '../../shared/domain'
import { ZERO_SNAPSHOT, flatZeroSeries } from '../portfolio.utils'
import type {
  ChartMetric,
  ChartState,
  ChartStateByMetric,
  UsePortfolioPageReturn,
} from './portfolio-page.types'
const CHART_METRICS: ReadonlyArray<ChartMetric> = ['accountValue', 'pnl', 'perpsPnl']
const DEFAULT_WINDOW: PortfolioWindow = '24H'
const DEFAULT_SCOPE: PortfolioAccountScope = 'all'
const DEFAULT_CHART_METRIC: ChartMetric = 'pnl'

function loadingChartState(): ChartStateByMetric {
  return {
    accountValue: { kind: 'loading' },
    pnl: { kind: 'loading' },
    perpsPnl: { kind: 'loading' },
  }
}

function flatZeroChartState(window: PortfolioWindow): ChartStateByMetric {
  const points = flatZeroSeries(window)
  const ready: ChartState = { kind: 'ready', points }
  return { accountValue: ready, pnl: ready, perpsPnl: ready }
}

export function usePortfolioPage(): UsePortfolioPageReturn {
  const venue = useVenue()
  const portfolioCap = venue.capabilities.portfolio
  const accountModeCap = venue.capabilities.accountMode
  const isConnected = useIsWalletConnected()
  const spectatedAddress = useSpectatedAddress()
  const { selectedAddress } = useSelectedWallet()
  const { primaryWalletAddress } = useAuth()
  // The active address lives in mutable module state inside the venue reader, so
  // React never sees it change on a wallet switch. Mirror the same React-reactive
  // source the SelectedWalletBridge writes from (Selected Wallet → Privy primary,
  // overridden by a Spectated Address) so the history fetch effect re-runs when
  // the viewed wallet changes — see selected-wallet-bridge.tsx.
  const connectedAddress = selectedAddress ?? primaryWalletAddress
  const activeAddress = spectatedAddress ?? connectedAddress
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null)
  const [window, setWindowState] = useState<PortfolioWindow>(DEFAULT_WINDOW)
  const [scope, setScopeState] = useState<PortfolioAccountScope>(DEFAULT_SCOPE)
  // Account-mode default is segregated (classic) — a transient read failure or a
  // venue without the capability keeps the full scope toggle (ADR-0033 D-4).
  const [isSegregated, setIsSegregated] = useState(true)
  const [chartMetric, setChartMetricState] = useState<ChartMetric>(DEFAULT_CHART_METRIC)
  const [charts, setCharts] = useState<ChartStateByMetric>(loadingChartState)
  const [trackedWindow, setTrackedWindow] = useState<PortfolioWindow>(window)
  const [trackedScope, setTrackedScope] = useState<PortfolioAccountScope>(scope)
  const [trackedAddress, setTrackedAddress] = useState<string | null>(activeAddress)
  const requestIdRef = useRef(0)
  // Stable retry handle: the error `ChartState` carries `onRetry`, but it must
  // not close over the (re-created) `runHistoryFetch`. We point a ref at the
  // latest fetcher and expose one stable callback that resets to the skeleton and
  // calls through it. As an event handler it may setState synchronously.
  const runHistoryFetchRef = useRef<() => void>(() => {})
  const handleRetry = useCallback(() => {
    setCharts(loadingChartState())
    runHistoryFetchRef.current()
  }, [])

  // A unified / portfolio-margin account has no meaningful perps-only view, so
  // the `'perps'` scope is unavailable; fall the active scope back to `'all'` so
  // we never subscribe the reader / fetch history for a phantom perps scope.
  const isPerpsScopeUnavailable = !isSegregated && scope === 'perps'

  if (isPerpsScopeUnavailable) {
    setScopeState('all')
  }

  const isWindowChanged = trackedWindow !== window
  const isScopeChanged = trackedScope !== scope
  // A wallet switch / late address populate (reload) re-runs the fetch effect;
  // show the skeleton instead of stale "No activity" while it re-fetches.
  const isAddressChanged = trackedAddress !== activeAddress
  const needsReset = isWindowChanged || isScopeChanged || isAddressChanged

  if (needsReset) {
    setTrackedWindow(window)
    setTrackedScope(scope)
    setTrackedAddress(activeAddress)
    setCharts(loadingChartState())
  }

  useEffect(() => {
    if (!accountModeCap) return
    return accountModeCap.subscribe((mode) => setIsSegregated(mode.isSegregated))
  }, [accountModeCap])

  useEffect(() => {
    if (!portfolioCap) return
    const unsubscribe = portfolioCap.subscribeSnapshot(scope, (next) => {
      setSnapshot(next)
    })
    return unsubscribe
  }, [portfolioCap, scope])

  const runHistoryFetch = useCallback(() => {
    if (!portfolioCap) return
    if (!isConnected) return
    requestIdRef.current += 1
    const requestId = requestIdRef.current

    for (const metric of CHART_METRICS) {
      portfolioCap.getHistory(metric, window, scope).match(
        (points: PortfolioPoint[]) => {
          const isStaleRequest = requestIdRef.current !== requestId
          if (isStaleRequest) return
          setCharts((previous) => ({
            ...previous,
            [metric]: { kind: 'ready', points } satisfies ChartState,
          }))
        },
        (error: PortfolioHistoryError) => {
          const isStaleRequest = requestIdRef.current !== requestId
          if (isStaleRequest) return
          setCharts((previous) => ({
            ...previous,
            [metric]: { kind: 'error', error, onRetry: handleRetry } satisfies ChartState,
          }))
        },
      )
    }
  }, [portfolioCap, window, scope, isConnected, handleRetry])

  useEffect(() => {
    runHistoryFetchRef.current = runHistoryFetch
  }, [runHistoryFetch])

  // Re-fetch when the viewed wallet (`activeAddress`) changes — the venue reader
  // reads the address from mutable module state, so it must be a React dep here
  // for a wallet switch / reload (address populated late) to re-run the fetch.
  useEffect(() => {
    runHistoryFetch()
  }, [runHistoryFetch, activeAddress])

  const setWindow = useCallback((next: PortfolioWindow) => {
    setWindowState(next)
  }, [])

  const setScope = useCallback((next: PortfolioAccountScope) => {
    setScopeState(next)
  }, [])

  const setChartMetric = useCallback((next: ChartMetric) => {
    setChartMetricState(next)
  }, [])

  const hasPortfolio = portfolioCap !== undefined

  if (!isConnected) {
    return {
      snapshot: ZERO_SNAPSHOT,
      isSnapshotLoading: false,
      window,
      setWindow,
      scope,
      setScope,
      chartMetric,
      setChartMetric,
      charts: flatZeroChartState(window),
      hasPortfolio,
      spectatedAddress,
      isSegregated,
    }
  }

  return {
    snapshot,
    // Loading only while a real read is pending: a venue without the portfolio
    // capability never emits a snapshot, so it falls through to the empty values
    // rather than an endless skeleton.
    isSnapshotLoading: hasPortfolio && snapshot === null,
    window,
    setWindow,
    scope,
    setScope,
    chartMetric,
    setChartMetric,
    charts,
    hasPortfolio,
    spectatedAddress,
    isSegregated,
  }
}
