import { useCallback, useMemo, useState } from 'react'
import { logger } from '@/app/logger'
import {
  clampWithdrawAmount,
  mapTransferReason,
  parseBaseAddress,
  validateUsdcAmount,
} from '../../agent-balance.utils'
import { MIN_TRANSFER_USDC } from '../../agent-balance.constants'
import type { RecipientSuggestion } from '@/modules/shared/components/recipient-combobox'
import type {
  AgentTransferErrorReason,
  AgentWithdrawAuthorizer,
  WithdrawFlowPhase,
  WithdrawFlowViewModel,
} from '../../agent-balance.types'

const log = logger.child({ module: 'agent-balance-withdraw' })

/**
 * Collaborators for the withdraw smart hook. Injected so the hook is
 * unit-testable without viem / Privy: tests supply an available balance and an
 * authorizer factory (returning a fake whose `authorizeAndSend` yields
 * `okAsync` / `errAsync`). Production binds the env-backed authorizer that
 * prompts the explicit per-action signature.
 */
export interface WithdrawFlowDeps {
  /** The Agent Wallet's available USDC, for amount validation + the withdrawable line. */
  readonly availableUsdc: number
  /** Resolves the explicit per-action withdraw authorizer (never the delegation). */
  readonly getWithdrawAuthorizer: () => AgentWithdrawAuthorizer
  /** The user's own wallets offered as destination suggestions. */
  readonly walletSuggestions: ReadonlyArray<RecipientSuggestion>
  /** Addresses the user recently sent to, offered as destination suggestions. */
  readonly recentSuggestions: ReadonlyArray<RecipientSuggestion>
  /** Persist a completed destination so it surfaces under "Recent" next time. */
  readonly onRecordRecipient: (address: string) => void
  /**
   * Switches the Agent Wallet's live chain to Base and re-verifies it took
   * effect (ADR-0082, reusing ADR-0080's switch + verify idiom). Called from
   * the `wrong-network` error state's action button — the only reason a plain
   * `retry()` (reset to `editing`) can never fix on its own.
   */
  readonly switchToBase: () => Promise<'switched' | 'rejected' | 'failed'>
}

/**
 * Smart hook behind the dumb withdraw body. Collects a destination + amount
 * (with Max + percent quick-fills of the withdrawable balance), requires an
 * explicit irreversible acknowledgement once a destination is entered, and on
 * submit triggers the EXPLICIT per-action authorization (a fresh signature the
 * User approves for this single withdrawal) — never the standing delegation
 * (ADR-0046 D-7). A malformed destination, an out-of-range amount, or an
 * un-ticked acknowledgement gates the submit off; a user-cancelled prompt returns
 * non-destructively to `editing` with the entered values preserved.
 */
export function useWithdrawFlow(deps: WithdrawFlowDeps): WithdrawFlowViewModel {
  const [phase, setPhase] = useState<WithdrawFlowPhase>('editing')
  const [destination, setDestination] = useState('')
  const [amount, setAmount] = useState('')
  const [confirmedIrreversible, setConfirmedIrreversible] = useState(false)
  const [errorReason, setErrorReason] = useState<AgentTransferErrorReason | null>(null)
  const [transactionHash, setTransactionHash] = useState<`0x${string}` | null>(null)

  const withdrawable = deps.availableUsdc

  const parsedDestination = useMemo(() => parseBaseAddress(destination), [destination])
  const isDestinationValid = parsedDestination !== null
  const isDestinationEdited = destination.trim() !== ''

  const validation = useMemo(
    () => validateUsdcAmount(amount, withdrawable),
    [amount, withdrawable],
  )

  const netReceived = validation.isValid ? validation.value : 0

  const hasValidInputs = isDestinationValid && validation.isValid
  const canSubmit = hasValidInputs && confirmedIrreversible

  const setAmountToMax = useCallback(() => {
    setAmount(clampWithdrawAmount(withdrawable))
  }, [withdrawable])

  const setPercent = useCallback(
    (percent: number) => {
      const portion = (withdrawable * percent) / 100
      setAmount(clampWithdrawAmount(portion))
    },
    [withdrawable],
  )

  const toggleConfirmIrreversible = useCallback(() => {
    setConfirmedIrreversible((prev) => !prev)
  }, [])

  const authorize = useCallback(() => {
    if (parsedDestination === null) return
    if (!validation.isValid) return
    if (!confirmedIrreversible) return

    const authorizer = deps.getWithdrawAuthorizer()
    const amountUsdc = validation.value
    setErrorReason(null)
    setPhase('authorizing')
    log.info({ amount: amountUsdc }, 'withdraw authorize')

    authorizer.authorizeAndSend(parsedDestination, amountUsdc).match(
      (receipt) => {
        log.info({ transactionHash: receipt.transactionHash }, 'withdraw sent')
        setTransactionHash(receipt.transactionHash)
        setPhase('sent')
        deps.onRecordRecipient(parsedDestination)
      },
      (error) => {
        const reason = mapTransferReason(error.kind)
        const isRejection = reason === 'wallet-rejected'
        if (isRejection) {
          log.info({}, 'withdraw rejected')
          setPhase('editing')
          return
        }
        log.warn({ kind: error.kind, errorMessage: error.message }, 'withdraw transfer failed')
        setErrorReason(reason)
        setPhase('error')
      },
    )
  }, [deps, parsedDestination, validation, confirmedIrreversible])

  const retry = useCallback(() => {
    const isWrongNetwork = errorReason === 'wrong-network'
    if (!isWrongNetwork) {
      setErrorReason(null)
      setTransactionHash(null)
      setPhase('editing')
      return
    }
    // "Try again" alone can never fix a wrong-network failure — the wallet's
    // live chain has to actually change first. Only clear the error once the
    // switch is verified; a rejected/failed switch leaves the same message up
    // so the user can retry the switch itself.
    deps.switchToBase().then((outcome) => {
      const didSwitch = outcome === 'switched'
      if (!didSwitch) {
        log.warn({ outcome }, 'switch to base failed')
        return
      }
      setErrorReason(null)
      setTransactionHash(null)
      setPhase('editing')
    })
  }, [errorReason, deps])

  return {
    phase,
    destination,
    isDestinationValid,
    isDestinationEdited,
    amount,
    isAmountValid: validation.isValid,
    amountInvalidReason: validation.isValid ? null : validation.reason,
    withdrawable,
    minWithdraw: MIN_TRANSFER_USDC,
    netReceived,
    confirmedIrreversible,
    canSubmit,
    walletSuggestions: deps.walletSuggestions,
    recentSuggestions: deps.recentSuggestions,
    errorReason,
    transactionHash,
    setDestination,
    setAmount,
    setAmountToMax,
    setPercent,
    toggleConfirmIrreversible,
    authorize,
    retry,
  }
}
