import { useCallback } from 'react'
import { useManageFunds } from '@/modules/shared/providers/manage-funds-provider'
import { formatUsd } from '@/modules/shared/utils/format-number'
import { useCashBalance } from './use-cash-balance'
import { useLiveBets } from './use-live-bets'
import { useSettledBets } from './use-settled-bets'
import type { MyBetsPageView } from '../my-bets.types'

/**
 * Page orchestrator for My Bets (PRD 0008 D11). Composes the cash-balance,
 * live-bets, and settled-bets hooks and wires ADD CASH / WITHDRAW to the shared
 * Manage Funds surface ("Add Cash" = Deposit, "Withdraw" = the withdraw tab —
 * the D7 vocabulary is applied at the button labels, not here).
 */
export function useMyBetsPage(): MyBetsPageView {
  const { cashUsd, isConnected } = useCashBalance()
  const { liveBets, onCashOut } = useLiveBets()
  const settledBets = useSettledBets()
  const { open } = useManageFunds()

  const onAddCash = useCallback(() => open('deposit'), [open])
  const onWithdraw = useCallback(() => open('withdraw'), [open])

  return {
    cashLabel: formatUsd(cashUsd),
    isConnected,
    onAddCash,
    onWithdraw,
    liveBets,
    onCashOut,
    settledBets,
  }
}
