import { useCallback, useContext, useState } from 'react'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import { useAuth, useIsWalletConnected, useSelectedWallet } from '@/modules/account'
import type { WalletAddress } from '@/modules/shared/domain'
import { useSessionBootstrap } from '../../hooks/use-session-bootstrap'
import {
  HYPERLIQUID_BUILDER_ADDRESS,
  HYPERLIQUID_BUILDER_FEE_TENTHS_OF_BPS,
} from '../../hyperliquid.constants'
import type { HyperliquidExchangeGateway } from '../../gateway/nktkas-hyperliquid-exchange-gateway'
import { BuilderFeeContext } from './builder-fee-provider.context'
import type { BuilderFeeState } from './builder-fee-provider.context'
import { BuilderFeeApprovalError } from './builder-fee-provider.types'
import type { BuilderFeeStatus } from './builder-fee-provider.types'
import { gatewayKindToBuilderReason } from './builder-fee.utils'

// Cast invariant: the constant is authored lowercase (hyperliquid.constants.ts),
// which is exactly the WalletAddress brand's shape — lets the revoke-picker
// filter compare against the gateway's branded addresses directly.
const OWN_BUILDER_ADDRESS = HYPERLIQUID_BUILDER_ADDRESS as WalletAddress

// ---------------------------------------------------------------------------
// Consumer hook — thin context read
// ---------------------------------------------------------------------------

export function useBuilderFee(): BuilderFeeState {
  const ctx = useContext(BuilderFeeContext)
  if (!ctx) throw new Error('useBuilderFee must be used inside <BuilderFeeProvider>')
  return ctx
}

// ---------------------------------------------------------------------------
// Smart hook — drives the builder-fee state machine
// ---------------------------------------------------------------------------

/**
 * `useOwnBuilderFee` is the smart hook mounted by `BuilderFeeProvider`.
 * Mirrors `useOwnAgentWallet`'s shape (ADR-0012 signing boundary).
 *
 * Bootstrap: when a primary wallet becomes available, query the on-chain
 * `maxBuilderFee`. If the approved rate is at least
 * `HYPERLIQUID_BUILDER_FEE_TENTHS_OF_BPS`, status = 'approved'; otherwise
 * 'missing' (stale or never-approved both lead to the same re-prompt path,
 * per ADR-0024).
 */
export function useOwnBuilderFee(
  exchangeGateway: HyperliquidExchangeGateway,
): BuilderFeeState {
  const { getMasterViemAccount } = useAuth()
  const isConnected = useIsWalletConnected()
  // Slice 07: builder-fee approval keys on the SELECTED WALLET master address,
  // not the single Primary Wallet (falls back to the Primary when the selection
  // is not connectable). Switching selection re-queries for the new account.
  const { masterAddress } = useSelectedWallet()

  const [status, setStatus] = useState<BuilderFeeStatus>('checking')
  // Active builder approvals (ours filtered out) — fetched lazily on the first
  // cap rejection to feed the revoke picker (ADR-0036 D-4). Not a bootstrap read.
  const [approvedBuilders, setApprovedBuilders] = useState<ReadonlyArray<WalletAddress> | null>(
    null,
  )

  const hasMasterWallet = masterAddress !== null
  const canBootstrap = isConnected && hasMasterWallet

  useSessionBootstrap({
    isConnected,
    canBootstrap,
    // Re-key on the Selected Wallet master (slice 07) so a selection switch
    // re-bootstraps the builder-fee status for the newly-selected account.
    bootstrapKey: masterAddress,
    onReset: () => {
      setStatus('checking')
      setApprovedBuilders(null)
    },
    run: (isCancelled) => {
      if (masterAddress === null) return
      void exchangeGateway.queryMaxBuilderFee(masterAddress).match(
        (approvedTenthsOfBps) => {
          if (isCancelled()) return
          const isCovered = approvedTenthsOfBps >= HYPERLIQUID_BUILDER_FEE_TENTHS_OF_BPS
          setStatus(isCovered ? 'approved' : 'missing')
        },
        (gatewayError) => {
          if (isCancelled()) return
          // Bootstrap failure shares the same SDK-error→reason taxonomy as the
          // approve path (#166). `rate-limited` is the common case here (HL's
          // info budget pressure); everything else lands in `unknown`.
          setStatus({ kind: 'error', reason: gatewayKindToBuilderReason(gatewayError.kind) })
        },
      )
    },
  })

  // ADR-0060: sign as the SELECTED WALLET — `resolveMasterAccount` takes the
  // resolved `master` address (embedded included) and threads it to the accessor,
  // rather than the accessor reading the Privy-canonical primary wallet.
  const resolveMasterAccount = useCallback(
    (master: WalletAddress) =>
      ResultAsync.fromPromise(
        getMasterViemAccount(master),
        (cause) =>
          new BuilderFeeApprovalError('signing-unavailable', 'getMasterViemAccount threw', cause),
      ).andThen((masterAccount) => {
        if (masterAccount === null) {
          return errAsync(
            new BuilderFeeApprovalError('signing-unavailable', 'Master wallet not available'),
          )
        }
        return okAsync(masterAccount)
      }),
    [getMasterViemAccount],
  )

  // Shared error tail for approve/replaceBuilder: mirror the reason into the
  // step status; on a cap rejection, lazily fetch the active builder approvals
  // (filtered of ours) so the revoke picker has rows (ADR-0036 D-4).
  // Fire-and-forget: the picker renders from state when the fetch lands.
  const reflectError = useCallback(
    (e: BuilderFeeApprovalError): BuilderFeeApprovalError => {
      setStatus({ kind: 'error', reason: e.kind })
      const isCapRejection = e.kind === 'approval-cap-reached'
      const canQuery = masterAddress !== null
      if (isCapRejection && canQuery) {
        void exchangeGateway.queryApprovedBuilders(masterAddress).map((builders) => {
          setApprovedBuilders(builders.filter((builder) => builder !== OWN_BUILDER_ADDRESS))
        })
      }
      return e
    },
    [masterAddress, exchangeGateway],
  )

  const approve = useCallback(() => {
    if (masterAddress === null) {
      return errAsync(
        new BuilderFeeApprovalError('signing-unavailable', 'No master wallet connected'),
      )
    }

    setStatus('approving')

    return resolveMasterAccount(masterAddress)
      .andThen((masterAccount) =>
        exchangeGateway
          .approveBuilderFee(masterAccount)
          .mapErr(
            (cause) =>
              new BuilderFeeApprovalError(
                gatewayKindToBuilderReason(cause.kind),
                `approveBuilderFee failed: ${cause.kind}`,
                cause,
              ),
          ),
      )
      .map(() => {
        setStatus('approved')
      })
      .mapErr(reflectError)
  }, [masterAddress, exchangeGateway, resolveMasterAccount, reflectError])

  const replaceBuilder = useCallback(
    (victimBuilder: WalletAddress) => {
      if (masterAddress === null) {
        return errAsync(
          new BuilderFeeApprovalError('signing-unavailable', 'No master wallet connected'),
        )
      }

      setStatus('approving')

      // Two chained master-wallet signatures (ADR-0036 D-4): a 0% re-approval
      // frees the victim's slot (HL has no dedicated revoke action), then the
      // normal 3.5 bps approval takes it. If the second leg fails, the slot is
      // already freed — the surfaced error's plain retry completes the flow.
      return resolveMasterAccount(masterAddress)
        .andThen((masterAccount) =>
          exchangeGateway
            .revokeBuilderFee(masterAccount, victimBuilder)
            .andThen(() => exchangeGateway.approveBuilderFee(masterAccount))
            .mapErr(
              (cause) =>
                new BuilderFeeApprovalError(
                  gatewayKindToBuilderReason(cause.kind),
                  `replaceBuilder failed: ${cause.kind}`,
                  cause,
                ),
            ),
        )
        .map(() => {
          setStatus('approved')
        })
        .mapErr(reflectError)
    },
    [masterAddress, exchangeGateway, resolveMasterAccount, reflectError],
  )

  return { status, approvedBuilders, approve, replaceBuilder }
}
