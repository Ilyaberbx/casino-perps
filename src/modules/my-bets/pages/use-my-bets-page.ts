import { useCallback } from 'react'
import { useManageFunds } from '@/modules/shared/providers/manage-funds-provider'
import { formatUsd } from '@/modules/shared/utils/format-number'
import { useAccountEquity } from './use-account-equity'
import { useOpenPositions } from './use-open-positions'
import { useClosedTrades } from './use-closed-trades'
import type { PositionsPageView } from '../my-bets.types'

/**
 * Page orchestrator for the positions page. Composes the equity, open-positions,
 * and closed-trades hooks and wires Deposit / Withdraw to the shared Manage
 * Funds surface.
 */
export function useMyBetsPage(): PositionsPageView {
  const { equityUsd, isConnected } = useAccountEquity()
  const { openPositions, onClose } = useOpenPositions()
  const closedTrades = useClosedTrades()
  const { open } = useManageFunds()

  const onDeposit = useCallback(() => open('deposit'), [open])
  const onWithdraw = useCallback(() => open('withdraw'), [open])

  return {
    equityLabel: formatUsd(equityUsd),
    isConnected,
    onDeposit,
    onWithdraw,
    openPositions,
    onClose,
    closedTrades,
  }
}
