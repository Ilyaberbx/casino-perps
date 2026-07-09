import { useCallback, useContext, useMemo, useReducer } from 'react'
import type { WalletClient } from 'viem'
import type { WalletAddress } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { ToastApi } from '@/modules/shared/services/toast'
import type { RecipientSuggestion } from '@/modules/shared/components/recipient-combobox'
import type { HyperliquidGatewayError } from '../../gateway/hyperliquid-gateway.types'
import { WithdrawFlowContext } from './withdraw-flow-provider.context'
import type {
  WithdrawFlowContextValue,
  WithdrawFlowState,
  WithdrawPercent,
} from './withdraw-flow-provider.types'
import {
  INITIAL_WITHDRAW_FLOW_STATE,
  withdrawFlowReducer,
} from './withdraw-flow.reducer'
import {
  MIN_WITHDRAW_USDC,
  WITHDRAW_FEE_USDC,
} from './withdraw-flow.constants'
import {
  failWithdraw,
  isValidDestination,
  mapGatewayErrorToWithdrawError,
  netReceived,
  percentOfWithdrawable,
  validateWithdrawAmount,
} from './withdraw-flow.utils'

/**
 * The single withdraw-gateway seam the flow consumes. A narrowed view of the
 * exchange gateway — only `withdraw3` — so tests inject a one-method fake.
 */
export interface WithdrawGateway {
  withdraw3(
    masterWallet: WalletClient,
    params: { destination: WalletAddress; amount: string },
  ): import('neverthrow').ResultAsync<void, HyperliquidGatewayError>
}

/**
 * Collaborators for the withdraw machine. Injected so the hook is unit-testable
 * without JSX / Privy: tests supply a fake gateway, a withdrawable cap, a stub
 * master-wallet accessor, and a fake toast.
 */
export interface WithdrawFlowDeps {
  readonly gateway: WithdrawGateway
  /**
   * Resolves the master wallet for the user-signed `withdraw3` action (ADR-0012).
   * Takes the resolved Selected-Wallet `master` address so the withdraw signs as
   * the Selected Wallet, mirroring the transfer flow.
   */
  readonly getMasterViemAccount: (master: WalletAddress) => Promise<WalletClient | null>
  /**
   * The resolved Selected-Wallet master address (`useSelectedWallet().masterAddress`).
   * `null` when no wallet resolves — `submit` aborts before signing, and it
   * also drives the destination prefill + `isApplicable`.
   */
  readonly masterAddress: WalletAddress | null
  /** Perp-withdrawable USDC cap (drives MAX, percent chips, and validation). */
  readonly withdrawableUsdc: number
  /** The user's own wallets offered as destination suggestions (self kept — a withdraw goes to your own wallet by default). */
  readonly walletSuggestions: ReadonlyArray<RecipientSuggestion>
  /** Addresses the user recently sent to, offered as destination suggestions. */
  readonly recentSuggestions: ReadonlyArray<RecipientSuggestion>
  /** Persist a completed destination so it surfaces under "Recent" next time. */
  readonly onRecordRecipient: (address: string) => void
  /** Imperative toast API (injected for deterministic tests). */
  readonly toast: ToastApi
  /** Called on optimistic success — e.g. to surface a sheet-level signal. */
  readonly onSuccess: () => void
  readonly logger: Logger
}

/** Internal: read the context value, asserting the provider is mounted. */
export function useWithdrawFlowContext(): WithdrawFlowContextValue {
  const ctx = useContext(WithdrawFlowContext)
  if (!ctx) throw new Error('useWithdrawFlow must be used inside <WithdrawFlowProvider>')
  return ctx
}

/** The rich machine state the dumb body consumes. */
export function useWithdrawFlow(): WithdrawFlowState {
  return useWithdrawFlowContext().flow
}

const SUCCESS_TOAST_TITLE = 'Withdrawal submitted'

export function useOwnWithdrawFlow(deps: WithdrawFlowDeps): WithdrawFlowContextValue {
  const log = useMemo(
    () => deps.logger.child({ module: 'hyperliquid-withdraw-flow' }),
    [deps.logger],
  )

  const prefillDestination = deps.masterAddress ?? ''
  const [state, dispatch] = useReducer(withdrawFlowReducer, {
    ...INITIAL_WITHDRAW_FLOW_STATE,
    destination: prefillDestination,
  })
  const { phase, amount, amountTouched, destination, isDestinationEdited, confirmedIrreversible } =
    state

  const withdrawable = deps.withdrawableUsdc

  const validation = useMemo(
    () => validateWithdrawAmount(amount, withdrawable),
    [amount, withdrawable],
  )
  const amountInvalidReason = amountTouched ? validation.reason : null
  const isDestinationValid = useMemo(() => isValidDestination(destination), [destination])

  // The confirm gate only arms once the destination is edited away from the
  // user's own (prefilled) wallet — withdrawing to yourself needs no extra ack.
  const isConfirmCleared = !isDestinationEdited || confirmedIrreversible
  const canReview = validation.isValid && isDestinationValid && isConfirmCleared

  const net = useMemo(
    () => netReceived(validation.isValid ? validation.value : Number(amount)),
    [validation, amount],
  )

  const isApplicable = deps.masterAddress !== null

  const setAmount = useCallback(
    (next: string) => dispatch({ type: 'AMOUNT_CHANGED', amount: next }),
    [],
  )
  const setAmountToMax = useCallback(
    () => dispatch({ type: 'AMOUNT_CHANGED', amount: withdrawable > 0 ? withdrawable.toString() : '' }),
    [withdrawable],
  )
  const setPercent = useCallback(
    (percent: WithdrawPercent) =>
      dispatch({ type: 'AMOUNT_CHANGED', amount: percentOfWithdrawable(percent, withdrawable) }),
    [withdrawable],
  )
  const setDestination = useCallback(
    (next: string) => dispatch({ type: 'DESTINATION_CHANGED', destination: next }),
    [],
  )
  const toggleConfirmIrreversible = useCallback(
    () => dispatch({ type: 'CONFIRM_TOGGLED' }),
    [],
  )
  const review = useCallback(() => {
    if (!canReview) return
    log.info({}, 'withdraw review')
    dispatch({ type: 'REVIEWED' })
  }, [canReview, log])
  const back = useCallback(() => dispatch({ type: 'BACK' }), [])
  const retry = useCallback(() => {
    log.info({}, 'withdraw retry')
    dispatch({ type: 'RETRY' })
  }, [log])
  const reset = useCallback(
    () => dispatch({ type: 'RESET', destination: prefillDestination }),
    [prefillDestination],
  )

  const submit = useCallback(async () => {
    log.info({}, 'withdraw submit')
    const validated = validateWithdrawAmount(amount, withdrawable)
    if (!validated.isValid) {
      const reason = validated.reason === 'Amount exceeds withdrawable balance'
        ? 'insufficient-balance'
        : 'amount-invalid'
      failWithdraw(log, dispatch, reason, { reason: validated.reason }, 'withdraw validation failed')
      return
    }
    if (!isValidDestination(destination)) {
      failWithdraw(log, dispatch, 'destination-invalid', {}, 'withdraw destination invalid')
      return
    }
    const master = deps.masterAddress
    const wallet = master === null ? null : await deps.getMasterViemAccount(master)
    if (wallet === null) {
      failWithdraw(log, dispatch, 'unknown', { reason: 'wallet-unavailable' }, 'withdraw aborted')
      return
    }
    dispatch({ type: 'SUBMITTED' })
    const result = await deps.gateway.withdraw3(wallet, {
      destination: destination.trim() as WalletAddress,
      amount: validated.value.toString(),
    })
    if (result.isErr()) {
      const { kind, message } = result.error
      const reason = mapGatewayErrorToWithdrawError(kind)
      failWithdraw(log, dispatch, reason, { kind, errorMessage: message }, 'withdraw failed')
      return
    }
    log.info({}, 'withdraw succeeded')
    dispatch({ type: 'SENT' })
    deps.onRecordRecipient(destination.trim())
    deps.toast.show({
      variant: 'success',
      title: SUCCESS_TOAST_TITLE,
      description: `Withdrawing ${validated.value} USDC to Arbitrum.`,
    })
    deps.onSuccess()
  }, [amount, destination, withdrawable, deps, log])

  const errorReason = state.phase === 'error' ? state.errorReason : null

  const flow: WithdrawFlowState = {
    phase,
    amount,
    destination,
    isDestinationEdited,
    confirmedIrreversible,
    withdrawable,
    fee: WITHDRAW_FEE_USDC,
    minWithdraw: MIN_WITHDRAW_USDC,
    netReceived: net,
    isAmountValid: validation.isValid,
    amountInvalidReason,
    isDestinationValid,
    walletSuggestions: deps.walletSuggestions,
    recentSuggestions: deps.recentSuggestions,
    canReview,
    errorReason,
    setAmount,
    setAmountToMax,
    setPercent,
    setDestination,
    toggleConfirmIrreversible,
    review,
    back,
    submit: () => void submit(),
    retry,
    reset,
  }

  return { flow, isApplicable }
}
