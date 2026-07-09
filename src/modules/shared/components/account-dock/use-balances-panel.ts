import { useState, useEffect, useCallback, useMemo } from 'react'
import { useIsWalletConnected } from '@/modules/account'
import { useIsSpectating } from '@/modules/spectate'
import { useVenue } from '@/modules/shared/providers/venue-provider'
import { useTransferSheet } from '@/modules/shared/providers/transfer-sheet-provider'
import type { Balance } from '@/modules/shared/domain'
import { SMALL_BALANCE_USD_THRESHOLD } from './balances-panel.constants'
import { transferPrefillForSource } from './balances-panel.utils'
import type { UseBalancesPanelReturn } from './balances-panel.types'

const TRANSFERABLE_ASSET = 'USDC'

export function useBalancesPanel(): UseBalancesPanelReturn {
  const isConnected = useIsWalletConnected()
  const isSpectating = useIsSpectating()
  const venue = useVenue()
  const { open: openTransferSheet } = useTransferSheet()
  const balancesCap = venue.capabilities.balances
  const accountModeCap = venue.capabilities.accountMode
  const hasTransferCapability = venue.transfer != null
  const [spotBalances, setSpotBalances] = useState<ReadonlyArray<Balance>>([])
  const [perpsBalances, setPerpsBalances] = useState<ReadonlyArray<Balance>>([])
  const [aggregateBalances, setAggregateBalances] = useState(false)
  const [hideSmallBalances, setHideSmallBalances] = useState(false)
  // First-emission readiness (ADR-0036): the balances cap pushes its complete
  // array on first emission per scope, so receipt of both is the loaded signal.
  const [spotLoaded, setSpotLoaded] = useState(false)
  const [perpsLoaded, setPerpsLoaded] = useState(false)
  // Absent capability ⇒ treat as segregated (classic) — the same default the
  // venue-agnostic `AccountMode` contract uses. See ADR-0033.
  const [isSegregated, setIsSegregated] = useState(true)

  useEffect(() => {
    if (!isConnected) return
    if (!balancesCap) return
    return balancesCap.subscribe('all', (next) => {
      setSpotBalances(next)
      setSpotLoaded(true)
    })
  }, [balancesCap, isConnected])

  useEffect(() => {
    if (!isConnected) return
    if (!balancesCap) return
    return balancesCap.subscribe('perps', (next) => {
      setPerpsBalances(next)
      setPerpsLoaded(true)
    })
  }, [balancesCap, isConnected])

  useEffect(() => {
    if (!accountModeCap) return
    return accountModeCap.subscribe((mode) => setIsSegregated(mode.isSegregated))
  }, [accountModeCap])

  const toggleAggregateBalances = useCallback(() => {
    setAggregateBalances((prev) => !prev)
  }, [])
  const toggleHideSmallBalances = useCallback(() => {
    setHideSmallBalances((prev) => !prev)
  }, [])

  const isUnified = !isSegregated

  // Unified accounts are a single pool — the perps scope returns no rows and the
  // Aggregate concept is meaningless, so never merge and never offer the toggle.
  const isAggregateOn = aggregateBalances && !isUnified
  const balances = useMemo<ReadonlyArray<Balance>>(() => {
    if (!isAggregateOn) return [...spotBalances, ...perpsBalances]
    return mergeByAsset(spotBalances, perpsBalances)
  }, [isAggregateOn, spotBalances, perpsBalances])

  const displayedBalances = hideSmallBalances
    ? balances.filter((b) => b.amountUsd >= SMALL_BALANCE_USD_THRESHOLD)
    : balances

  const hasBalancesCap = balancesCap !== undefined
  const isLoading = isConnected && hasBalancesCap && !(spotLoaded && perpsLoaded)
  const isEmpty = !isLoading && displayedBalances.length === 0

  // Same gate as `transfer-trigger` (ADR-0033 D-4): the venue must expose the
  // `transfer` capability, the wallet must be connected, the account must be
  // segregated, and the app must not be spectating. Unified accounts have
  // `isSegregated: false`, so the whole panel is gated off there regardless of
  // row source. Spectating hides the affordance too — Transfer signs with the
  // connected wallet, never the Spectated Address (ADR-0021), so the row's
  // balance is someone else's but the transfer would move the User's own funds.
  const isTransferAvailable =
    hasTransferCapability && isConnected && isSegregated && !isSpectating
  const canTransfer = useCallback(
    (balance: Balance) => {
      const isTransferableAsset = balance.asset === TRANSFERABLE_ASSET
      const isUnifiedRow = balance.source === 'unified'
      return isTransferAvailable && isTransferableAsset && !isUnifiedRow
    },
    [isTransferAvailable],
  )
  const onTransfer = useCallback(
    (balance: Balance) => openTransferSheet(transferPrefillForSource(balance.source)),
    [openTransferSheet],
  )

  return {
    balances,
    isUnified,
    aggregateBalances: isAggregateOn,
    hideSmallBalances,
    toggleAggregateBalances,
    toggleHideSmallBalances,
    displayedBalances,
    isLoading,
    isEmpty,
    canTransfer,
    onTransfer,
  }
}

function mergeByAsset(
  a: ReadonlyArray<Balance>,
  b: ReadonlyArray<Balance>,
): ReadonlyArray<Balance> {
  const byAsset = new Map<string, Balance>()
  for (const row of [...a, ...b]) {
    const existing = byAsset.get(row.asset)
    if (existing === undefined) {
      byAsset.set(row.asset, row)
      continue
    }
    byAsset.set(row.asset, {
      asset: row.asset,
      amount: existing.amount + row.amount,
      available: existing.available + row.available,
      amountUsd: existing.amountUsd + row.amountUsd,
      pnlPct: row.pnlPct ?? existing.pnlPct,
      source: 'aggregated',
    })
  }
  return Array.from(byAsset.values())
}
