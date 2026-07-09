import { useCallback, useContext, useMemo, useState } from 'react'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import { useAuth, useIsWalletConnected, useSelectedWallet } from '@/modules/account'
import {
  Hip3AbstractionError,
  type Hip3AbstractionState,
  type Hip3AbstractionStatus,
} from '@/modules/shared/domain'
import type { WalletAddress } from '@/modules/shared/domain'
import { useSessionBootstrap } from '../../hooks/use-session-bootstrap'
import type { HyperliquidExchangeGateway } from '../../gateway/nktkas-hyperliquid-exchange-gateway'
import { Hip3AbstractionContext } from './hip3-abstraction-provider.context'
import { gatewayKindToHip3Reason, isAbstractionEnabled } from './hip3-abstraction.utils'

// ---------------------------------------------------------------------------
// Consumer hook — thin context read
// ---------------------------------------------------------------------------

export function useHyperliquidHip3Abstraction(): Hip3AbstractionState {
  const ctx = useContext(Hip3AbstractionContext)
  if (!ctx) {
    throw new Error(
      'useHyperliquidHip3Abstraction must be used inside <Hip3AbstractionProvider>',
    )
  }
  return ctx
}

// ---------------------------------------------------------------------------
// Smart hook — drives the HIP-3-abstraction state machine
// ---------------------------------------------------------------------------

/**
 * `useOwnHip3Abstraction` is the smart hook mounted by `Hip3AbstractionProvider`.
 * Mirrors `useOwnBuilderFee` (ADR-0012 signing boundary).
 *
 * Bootstrap: when the Selected Wallet master becomes available, read the
 * account's abstraction mode (`queryUserAbstraction`). If collateral is already
 * abstracted across HIP-3 DEXs (`dexAbstraction` / unified / portfolio margin),
 * status = 'enabled'; a classic `default` / `disabled` account is 'disabled'.
 *
 * `enable()` signs a single master-wallet `userDexAbstraction(enabled:true)`
 * action, opting a default account into cross-DEX collateral abstraction so
 * HIP-3 markets stop rejecting orders with "insufficient margin" — WITHOUT
 * switching the account to unified / portfolio margin (ADR-0081).
 */
export function useOwnHip3Abstraction(
  exchangeGateway: HyperliquidExchangeGateway,
): Hip3AbstractionState {
  const { getMasterViemAccount } = useAuth()
  const isConnected = useIsWalletConnected()
  // Keys on the Selected Wallet master (mirrors builder-fee slice 07) so a
  // selection switch re-reads the abstraction mode for the newly-selected account.
  const { masterAddress } = useSelectedWallet()

  const [status, setStatus] = useState<Hip3AbstractionStatus>('checking')

  const canBootstrap = isConnected && masterAddress !== null

  useSessionBootstrap({
    isConnected,
    canBootstrap,
    bootstrapKey: masterAddress,
    onReset: () => setStatus('checking'),
    run: (isCancelled) => {
      if (masterAddress === null) return
      void exchangeGateway.queryUserAbstraction(masterAddress).match(
        (mode) => {
          if (isCancelled()) return
          setStatus(isAbstractionEnabled(mode) ? 'enabled' : 'disabled')
        },
        (gatewayError) => {
          if (isCancelled()) return
          setStatus({ kind: 'error', reason: gatewayKindToHip3Reason(gatewayError.kind) })
        },
      )
    },
  })

  // ADR-0060: sign as the Selected Wallet master (embedded included).
  const resolveMasterAccount = useCallback(
    (master: WalletAddress) =>
      ResultAsync.fromPromise(
        getMasterViemAccount(master),
        (cause) =>
          new Hip3AbstractionError('signing-unavailable', 'getMasterViemAccount threw', cause),
      ).andThen((masterAccount) => {
        if (masterAccount === null) {
          return errAsync(
            new Hip3AbstractionError('signing-unavailable', 'Master wallet not available'),
          )
        }
        return okAsync(masterAccount)
      }),
    [getMasterViemAccount],
  )

  const enable = useCallback(() => {
    if (masterAddress === null) {
      return errAsync(
        new Hip3AbstractionError('signing-unavailable', 'No master wallet connected'),
      )
    }

    setStatus('enabling')

    return resolveMasterAccount(masterAddress)
      .andThen((masterAccount) =>
        exchangeGateway
          .enableDexAbstraction(masterAccount, masterAddress)
          .mapErr(
            (cause) =>
              new Hip3AbstractionError(
                gatewayKindToHip3Reason(cause.kind),
                `enableDexAbstraction failed: ${cause.kind}`,
                cause,
              ),
          ),
      )
      .map(() => {
        // Optimistic: HL applies the setting synchronously on status:ok. The
        // next bootstrap read (on reconnect/selection switch) confirms it.
        setStatus('enabled')
      })
      .mapErr((e) => {
        setStatus({ kind: 'error', reason: e.reason })
        return e
      })
  }, [masterAddress, exchangeGateway, resolveMasterAccount])

  return useMemo<Hip3AbstractionState>(() => ({ status, enable }), [status, enable])
}
