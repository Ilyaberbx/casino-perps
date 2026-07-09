import { useCallback, useEffect } from 'react'
import type { WalletClient } from 'viem'
import type { WalletSource } from '@/modules/account'
import type { WalletAddress } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import { formatAddress } from '@/modules/shared/logger'
import type { HyperliquidDepositService } from '../../services/hyperliquid-deposit-service.types'
import type { DepositFlowAction } from './deposit-flow-provider.types'
import {
  describeCause,
  failWith,
  mapErrorToReason,
  resolveBranchPhase,
} from './deposit-flow.utils'

export interface DepositPreflightOptions {
  readonly service: HyperliquidDepositService
  readonly address: WalletAddress | null
  readonly getBroadcastWalletClient: (master: WalletAddress) => Promise<WalletClient | null>
  readonly walletSource: WalletSource | null
  readonly isBroadcastWalletReady: boolean
  readonly log: Logger
  readonly preflightNonce: number
  readonly dispatch: (action: DepositFlowAction) => void
}

/**
 * Owns the broadcast-wallet resolution, the pre-flight read (balances + chain),
 * the broadcast-wallet readiness gate, and the mount/nonce-keyed effect that
 * kicks pre-flight. Returns `resolveWallet` so the orchestrator's signing
 * actions share the same throw-safe accessor.
 */
export function useDepositPreflight(options: DepositPreflightOptions): {
  resolveWallet: () => Promise<WalletClient | null>
} {
  const { service, address, getBroadcastWalletClient, log, preflightNonce, dispatch } = options

  // Resolve the broadcast wallet for the deposit master (ADR-0060: the resolved
  // Selected-Wallet master, embedded included — `address`), converting a THROWN
  // accessor (vs a returned null) into a logged error + null. Without this a
  // rejected accessor escapes as an unhandled rejection and the flow strands on
  // `checking` with no trace. Returns null when there is no master address yet.
  const resolveWallet = useCallback(
    (): Promise<WalletClient | null> => {
      if (address === null) return Promise.resolve(null)
      return getBroadcastWalletClient(address).catch((cause: unknown) => {
        log.error({ errorMessage: describeCause(cause) }, 'wallet accessor threw')
        return null
      })
    },
    [address, getBroadcastWalletClient, log],
  )

  // Pre-flight: read balances + chain, resolve into a branch. The first dispatch
  // happens only AFTER an await (the balance read), so the kicking effect never
  // synchronously triggers a cascading render — initial state is already `checking`.
  const runPreflight = useCallback(async () => {
    // Yield a microtask first so the very first dispatch below never lands
    // synchronously inside the mount effect (react-hooks/set-state-in-effect).
    await Promise.resolve()
    log.info({ address: formatAddress(address) }, 'preflight start')
    const wallet = address === null ? null : await resolveWallet()
    if (address === null || wallet === null) {
      failWith(log, dispatch, 'unknown', { reason: 'wallet-unavailable' }, 'preflight aborted')
      return
    }
    const balancesResult = await service.readBalances(address)
    if (balancesResult.isErr()) {
      const { kind, message, cause } = balancesResult.error
      const fields = { kind, errorMessage: message, cause: describeCause(cause) }
      failWith(log, dispatch, mapErrorToReason(kind), fields, 'preflight balance read failed')
      return
    }
    const balances = balancesResult.value
    dispatch({ type: 'BALANCE_TICK', walletUsdc: balances.usdc })

    const chainResult = await service.readChainId(wallet)
    if (chainResult.isErr()) {
      const { kind, message, cause } = chainResult.error
      const fields = { kind, errorMessage: message, cause: describeCause(cause) }
      failWith(log, dispatch, mapErrorToReason(kind), fields, 'preflight chain read failed')
      return
    }
    const resolved = resolveBranchPhase(balances.usdc, balances.ethForGas, chainResult.value)
    log.info(
      { phase: resolved, usdc: balances.usdc, ethForGas: balances.ethForGas, chainId: chainResult.value },
      'preflight resolved',
    )
    dispatch({ type: 'PREFLIGHT_RESOLVED', phase: resolved, walletUsdc: balances.usdc })
  }, [service, address, resolveWallet, log, dispatch])

  // An external Primary Wallet re-hydrates into Privy's `wallets` a tick AFTER
  // the canonical address is known, so on first sheet-open the broadcast wallet
  // is briefly unresolvable even though `walletReady` is already true. Wait in
  // `checking` (the initial phase) for that window instead of aborting
  // `wallet-unavailable` — the effect re-runs and resolves the moment the wallet
  // appears. Embedded-only users never resolve a broadcast wallet, so they are
  // NOT waited on: preflight runs and hits the genuine `wallet === null` abort.
  const isExternalWallet = options.walletSource === 'external'
  const isWaitingForBroadcastWallet = isExternalWallet && !options.isBroadcastWalletReady

  // Run pre-flight on mount and on every `preflightNonce` bump (retry / post
  // chain-switch), gated on the broadcast wallet being ready. Keying on the nonce
  // (rather than calling `runPreflight` imperatively) guarantees the re-run uses
  // the latest committed closure — crucially the new `depositId` after a retry.
  useEffect(() => {
    if (isWaitingForBroadcastWallet) return
    Promise.resolve().then(() => runPreflight())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial run gated on broadcast-wallet readiness; re-runs keyed on preflightNonce; runPreflight is re-derived each render but only the nonce/readiness should re-trigger it
  }, [preflightNonce, isWaitingForBroadcastWallet])

  return { resolveWallet }
}
