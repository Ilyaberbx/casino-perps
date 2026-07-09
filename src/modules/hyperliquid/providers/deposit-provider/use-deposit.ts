import { useCallback, useContext, useState } from 'react'
import { useIsWalletConnected, useSelectedWallet } from '@/modules/account'
import type { WalletAddress } from '@/modules/shared/domain'
import { useSessionBootstrap } from '../../hooks/use-session-bootstrap'
import type { HyperliquidExchangeGateway } from '../../gateway/nktkas-hyperliquid-exchange-gateway'
import { DepositContext } from './deposit-provider.context'
import type { DepositState } from './deposit-provider.context'
import type { DepositStatus } from './deposit-provider.types'
import { gatewayKindToDepositReason } from './deposit-provider.utils'

// ---------------------------------------------------------------------------
// Consumer hook — thin context read
// ---------------------------------------------------------------------------

export function useDeposit(): DepositState {
  const ctx = useContext(DepositContext)
  if (!ctx) throw new Error('useDeposit must be used inside <DepositProvider>')
  return ctx
}

// ---------------------------------------------------------------------------
// Smart hook — drives the deposit funded-state machine
// ---------------------------------------------------------------------------

/**
 * `useOwnDeposit` is the smart hook mounted by `DepositProvider`.
 * Mirrors `useOwnBuilderFee`'s shape.
 *
 * Bootstrap: when a Selected Wallet master becomes available, query the **First
 * Deposit** milestone via `queryHasEverFunded(user)` (ADR-0027 — chain-derived
 * from ledger history, NOT current balance). ok(true) → 'funded' (the Account
 * has ever been funded — its non-funding ledger is non-empty); ok(false) →
 * 'needs-deposit' (never funded — empty ledger); err → error status (genuine
 * query failure).
 *
 * 'funded' here means "ever funded by any means" (bridge deposit OR transfer
 * in OR vault return — any ledger activity), so a later withdrawal that empties
 * the account does NOT flip this back to 'needs-deposit' — onboarding does not
 * re-nag. The live "can this account trade right now" check is **Tradeable
 * Funds**, a separate order-submit gate (`TradeableFundsGateButton`).
 *
 * recheck() re-runs queryHasEverFunded without signing (D-7 / Pitfall 4 — the
 * deposit step is a read-only check; no master wallet, no approve). It exists
 * so the "I've deposited — re-check" affordance works while a fresh deposit is
 * still settling into ledger history.
 */
export function useOwnDeposit(exchangeGateway: HyperliquidExchangeGateway): DepositState {
  const isConnected = useIsWalletConnected()
  // Slice 07: the First Deposit milestone is step 0 of venue onboarding, so it
  // keys on the SELECTED WALLET master (the same `(Selected Wallet × venue)`
  // gate as agent/builder), not the single Primary Wallet.
  const { masterAddress } = useSelectedWallet()

  const [status, setStatus] = useState<DepositStatus>('checking')

  const hasMasterWallet = masterAddress !== null
  const canBootstrap = isConnected && hasMasterWallet

  // Apply a queryHasEverFunded result to status (shared by bootstrap + recheck).
  const applyFundedQuery = useCallback(
    (address: WalletAddress, isCancelled: () => boolean = () => false): void => {
      void exchangeGateway.queryHasEverFunded(address).match(
        (hasEverFunded) => {
          if (isCancelled()) return
          setStatus(hasEverFunded ? 'funded' : 'needs-deposit')
        },
        (gatewayError) => {
          if (isCancelled()) return
          setStatus({ kind: 'error', reason: gatewayKindToDepositReason(gatewayError.kind) })
        },
      )
    },
    [exchangeGateway],
  )

  useSessionBootstrap({
    isConnected,
    canBootstrap,
    // Re-key on the Selected Wallet master (slice 07) so a selection switch
    // re-evaluates the funded milestone for the newly-selected account.
    bootstrapKey: masterAddress,
    onReset: () => setStatus('checking'),
    run: (isCancelled) => {
      if (masterAddress === null) return
      applyFundedQuery(masterAddress, isCancelled)
    },
  })

  const recheck = useCallback(() => {
    if (!canBootstrap) return
    if (masterAddress === null) return
    applyFundedQuery(masterAddress)
  }, [canBootstrap, masterAddress, applyFundedQuery])

  return { status, recheck }
}
