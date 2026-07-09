import { useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { logger } from '@/app/logger'
import { useAuth, useRecipientSuggestions, useSelectedWallet } from '@/modules/account'
import { useVenueOptional } from '@/modules/shared/providers/venue-provider'
import { toast } from '@/modules/shared/services/toast'
import type { Balance } from '@/modules/shared/domain'
import { loadHyperliquidConfig } from '../../hyperliquid.config'
import { createNktkasHyperliquidExchangeGateway } from '../../gateway/nktkas-hyperliquid-exchange-gateway'
import { WithdrawFlowContext } from './withdraw-flow-provider.context'
import { useOwnWithdrawFlow } from './use-withdraw-flow'
import { selectWithdrawableUsdc } from './withdraw-flow.utils'

// Load Hyperliquid config once at module init — mirrors TransferFlowProvider.
const configResult = loadHyperliquidConfig(import.meta.env as Record<string, string | undefined>)
const isTestnet = configResult.isOk() ? configResult.value.network === 'testnet' : false

/**
 * WithdrawFlowProvider owns the HL Withdraw-to-Arbitrum state machine. Mounted by
 * the generic withdraw-sheet host as `venue.withdraw.provider`. Self-contained:
 * builds its own exchange gateway (for the master-wallet-signed `withdraw3`
 * action — mirrors TransferFlowProvider), reads the master-wallet accessor from
 * `useAuth()` + the resolved Selected-Wallet master from `useSelectedWallet()`
 * (ADR-0012 / ADR-0060), and derives the withdrawable cap mode-aware from the
 * active venue's live `balances` + `accountMode` (perps-scope USDC for segregated,
 * all-scope unified USDC for unified). On optimistic success it toasts; the
 * body's `sent` arrival track + Done button handle dismissal. Mirrors ADR-0033.
 */
export function WithdrawFlowProvider({ children }: { children: ReactNode }) {
  const { getMasterViemAccount } = useAuth()
  const { masterAddress } = useSelectedWallet()
  const venue = useVenueOptional()

  // Destination suggestions: the user's own wallets (self kept — a withdrawal to
  // your own wallet is the intended default) + recently-sent addresses. Sourced
  // from the shared `account` hook; recorded on success via `recordRecipient`.
  const { walletSuggestions, recentSuggestions, recordRecipient } = useRecipientSuggestions({
    selfAddress: null,
  })

  const gateway = useMemo(
    () => createNktkasHyperliquidExchangeGateway({ isTestnet, logger }),
    [],
  )

  // The withdrawable cap is account-mode-dependent (hyperliquid-account-modes.md
  // §1/§3): a SEGREGATED account withdraws from its perp pool (the `'perps'`-scope
  // USDC `available`); a UNIFIED / portfolio-margin account withdraws from its
  // single collateral pool (the `'all'`-scope unified USDC row) — the `'perps'`
  // scope is deliberately EMPTY for unified accounts, so reading only it stranded
  // unified users at $0. Mirror the Transfer flow: subscribe to BOTH scopes + read
  // `accountMode`, then select. Reads the ACTING-keyed reader (`ownAccount`,
  // ADR-0038) so the cap reflects the User's own account even while Spectating.
  const balances = venue?.capabilities.ownAccount?.balances ?? null
  const accountMode = venue?.capabilities.accountMode ?? null
  const [perpsRows, setPerpsRows] = useReducer(
    (_prev: ReadonlyArray<Balance>, next: ReadonlyArray<Balance>) => next,
    [] as ReadonlyArray<Balance>,
  )
  const [allRows, setAllRows] = useReducer(
    (_prev: ReadonlyArray<Balance>, next: ReadonlyArray<Balance>) => next,
    [] as ReadonlyArray<Balance>,
  )
  useEffect(() => {
    if (!balances) return
    const unsubPerps = balances.subscribe('perps', setPerpsRows)
    const unsubAll = balances.subscribe('all', setAllRows)
    return () => {
      unsubPerps()
      unsubAll()
    }
  }, [balances])

  // Default to segregated when the mode is unknown (the classic assumption —
  // never strip a classic user of the perp-pool read on a transient failure),
  // matching the Transfer flow (use-transfer-flow.ts).
  const [isSegregated, setIsSegregated] = useReducer(
    (_prev: boolean, next: boolean) => next,
    accountMode?.current().isSegregated ?? true,
  )
  useEffect(() => {
    if (!accountMode) {
      setIsSegregated(true)
      return
    }
    setIsSegregated(accountMode.current().isSegregated)
    return accountMode.subscribe((mode) => setIsSegregated(mode.isSegregated))
  }, [accountMode])

  const withdrawableUsdc = selectWithdrawableUsdc(isSegregated, perpsRows, allRows)

  const value = useOwnWithdrawFlow({
    gateway,
    getMasterViemAccount,
    masterAddress,
    withdrawableUsdc,
    walletSuggestions,
    recentSuggestions,
    onRecordRecipient: recordRecipient,
    toast,
    onSuccess: () => {},
    logger,
  })

  return <WithdrawFlowContext.Provider value={value}>{children}</WithdrawFlowContext.Provider>
}
