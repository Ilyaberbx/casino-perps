import { useCallback, useContext, useMemo, useReducer } from 'react'
import type { ResultAsync } from 'neverthrow'
import type { WalletClient } from 'viem'
import type { WalletAddress } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { ToastApi } from '@/modules/shared/services/toast'
import type { HyperliquidGatewayError } from '../../gateway/hyperliquid-gateway.types'
import { deriveFlowAssetsStatus } from '../../components/shared-flow/shared-flow.utils'
import type { FlowMetaStatus } from '../../components/shared-flow/shared-flow.types'
import { SendFlowContext } from './send-flow-provider.context'
import type { RecipientSuggestion } from '@/modules/shared/components/recipient-combobox'
import type {
  SendableToken,
  SendFlowContextValue,
  SendFlowState,
  SendPercent,
} from './send-flow-provider.types'
import { INITIAL_SEND_FLOW_STATE, sendFlowReducer } from './send-flow.reducer'
import { SEND_ERROR_PROSE } from './send-flow.constants'
import {
  failSend,
  mapGatewayErrorToSendError,
  percentOfAvailable,
  resolveSelectedToken,
  validateSendAmount,
  validateSendDestination,
} from './send-flow.utils'

/**
 * The narrowed send-gateway seam the flow consumes. A view of the exchange
 * gateway — only `usdSend` + `spotSend` — so tests inject a two-method fake.
 */
export interface SendGateway {
  usdSend(
    masterWallet: WalletClient,
    params: { destination: WalletAddress; amount: string },
  ): ResultAsync<void, HyperliquidGatewayError>
  spotSend(
    masterWallet: WalletClient,
    params: { destination: WalletAddress; token: string; amount: string },
  ): ResultAsync<void, HyperliquidGatewayError>
}

/**
 * Collaborators for the send machine. Injected so the hook is unit-testable
 * without JSX / Privy: tests supply a fake gateway, a sendable-token list, a stub
 * master-wallet accessor, and a fake toast.
 */
export interface SendFlowDeps {
  readonly gateway: SendGateway
  /**
   * Resolves the master wallet for the user-signed `usdSend` / `spotSend` action
   * (ADR-0012). Takes the resolved Selected-Wallet `master` address so the send
   * signs as the Selected Wallet, mirroring the withdraw flow.
   */
  readonly getMasterViemAccount: (master: WalletAddress) => Promise<WalletClient | null>
  /**
   * The resolved Selected-Wallet master address (`useSelectedWallet().masterAddress`).
   * `null` when no wallet resolves — `submit` aborts before signing, it drives
   * the own-address (self-send) guard, and (with a non-empty token list) drives
   * `isApplicable`.
   */
  readonly masterAddress: WalletAddress | null
  /** Every sendable token the provider self-wired (USDC + held spot tokens). */
  readonly tokens: ReadonlyArray<SendableToken>
  /** The user's own wallets (minus the Selected Wallet) offered as recipient suggestions. */
  readonly walletSuggestions: ReadonlyArray<RecipientSuggestion>
  /** Addresses the user recently sent to, offered as recipient suggestions. */
  readonly recentSuggestions: ReadonlyArray<RecipientSuggestion>
  /** Persist a completed recipient so it surfaces under "Recent" next time. */
  readonly onRecordRecipient: (address: string) => void
  /** The spot-meta fetch status — drives the picker's loading / error state. */
  readonly metaStatus: FlowMetaStatus
  /** Re-run the spot-meta fetch (the picker's `error`-state retry). */
  readonly retryAssets: () => void
  /** Imperative toast API (injected for deterministic tests). */
  readonly toast: ToastApi
  /** Called on optimistic success — e.g. to surface a sheet-level signal. */
  readonly onSuccess: () => void
  readonly logger: Logger
}

/** Internal: read the context value, asserting the provider is mounted. */
export function useSendFlowContext(): SendFlowContextValue {
  const ctx = useContext(SendFlowContext)
  if (!ctx) throw new Error('useSendFlow must be used inside <SendFlowProvider>')
  return ctx
}

/** The rich machine state the dumb body consumes. */
export function useSendFlow(): SendFlowState {
  return useSendFlowContext().flow
}

const SUCCESS_TOAST_TITLE = 'Send submitted'

export function useOwnSendFlow(deps: SendFlowDeps): SendFlowContextValue {
  const log = useMemo(
    () => deps.logger.child({ module: 'hyperliquid-send-flow' }),
    [deps.logger],
  )

  const [state, dispatch] = useReducer(sendFlowReducer, INITIAL_SEND_FLOW_STATE)
  const { phase, selectedTokenKey, amount, amountTouched, destination, destinationTouched } = state

  const tokens = deps.tokens
  const selectedToken = useMemo(
    () => resolveSelectedToken(tokens, selectedTokenKey),
    [tokens, selectedTokenKey],
  )
  const available = selectedToken?.available ?? 0
  const symbol = selectedToken?.symbol ?? ''
  const decimals = selectedToken?.decimals ?? 0

  const amountValidation = useMemo(
    () => validateSendAmount(amount, available, decimals),
    [amount, available, decimals],
  )
  const amountInvalidReason = amountTouched ? amountValidation.reason : null

  const destinationValidation = useMemo(
    () => validateSendDestination(destination, deps.masterAddress),
    [destination, deps.masterAddress],
  )
  const destinationInvalidReason = destinationTouched
    ? destinationValidation.isValid
      ? null
      : SEND_ERROR_PROSE[destinationValidation.reason]
    : null

  const hasSelectedToken = selectedToken !== null
  const canReview =
    hasSelectedToken && amountValidation.isValid && destinationValidation.isValid

  const isApplicable = deps.masterAddress !== null && tokens.length > 0
  const assetsStatus = deriveFlowAssetsStatus(deps.metaStatus, tokens.length)

  const selectToken = useCallback(
    (key: string) => dispatch({ type: 'TOKEN_SELECTED', key }),
    [],
  )
  const setAmount = useCallback(
    (next: string) => dispatch({ type: 'AMOUNT_CHANGED', amount: next }),
    [],
  )
  const setAmountToMax = useCallback(
    () =>
      dispatch({
        type: 'AMOUNT_CHANGED',
        amount: available > 0 ? available.toString() : '',
      }),
    [available],
  )
  const setPercent = useCallback(
    (percent: SendPercent) =>
      dispatch({
        type: 'AMOUNT_CHANGED',
        amount: percentOfAvailable(percent, available, decimals),
      }),
    [available, decimals],
  )
  const setDestination = useCallback(
    (next: string) => dispatch({ type: 'DESTINATION_CHANGED', destination: next }),
    [],
  )
  const review = useCallback(() => {
    if (!canReview) return
    log.info({}, 'send review')
    dispatch({ type: 'REVIEWED' })
  }, [canReview, log])
  const back = useCallback(() => dispatch({ type: 'BACK' }), [])
  const retry = useCallback(() => {
    log.info({}, 'send retry')
    dispatch({ type: 'RETRY' })
  }, [log])
  const reset = useCallback(() => {
    const fallbackKey = tokens[0]?.key ?? INITIAL_SEND_FLOW_STATE.selectedTokenKey
    dispatch({ type: 'RESET', selectedTokenKey: fallbackKey })
  }, [tokens])

  const submit = useCallback(async () => {
    log.info({}, 'send submit')
    const token = resolveSelectedToken(tokens, selectedTokenKey)
    if (token === null) {
      failSend(log, dispatch, 'unknown', { reason: 'no-token' }, 'send aborted — no token')
      return
    }
    const validated = validateSendAmount(amount, token.available, token.decimals)
    if (!validated.isValid) {
      const reason =
        validated.reason === 'Amount exceeds available balance'
          ? 'insufficient-balance'
          : 'amount-invalid'
      failSend(log, dispatch, reason, { reason: validated.reason }, 'send validation failed')
      return
    }
    const destinationCheck = validateSendDestination(destination, deps.masterAddress)
    if (!destinationCheck.isValid) {
      failSend(log, dispatch, destinationCheck.reason, {}, 'send destination invalid')
      return
    }
    const master = deps.masterAddress
    const wallet = master === null ? null : await deps.getMasterViemAccount(master)
    if (wallet === null) {
      failSend(log, dispatch, 'unknown', { reason: 'wallet-unavailable' }, 'send aborted')
      return
    }
    dispatch({ type: 'SUBMITTED' })
    const recipient = destination.trim() as WalletAddress
    const amountString = validated.value.toString()
    const result =
      token.kind === 'usd'
        ? await deps.gateway.usdSend(wallet, { destination: recipient, amount: amountString })
        : await deps.gateway.spotSend(wallet, {
            destination: recipient,
            token: token.tokenId,
            amount: amountString,
          })
    if (result.isErr()) {
      const { kind, message } = result.error
      const reason = mapGatewayErrorToSendError(kind)
      failSend(log, dispatch, reason, { kind, errorMessage: message }, 'send failed')
      return
    }
    log.info({}, 'send succeeded')
    dispatch({ type: 'SENT' })
    deps.onRecordRecipient(recipient)
    deps.toast.show({
      variant: 'success',
      title: SUCCESS_TOAST_TITLE,
      description: `Sending ${validated.value} ${token.symbol}.`,
    })
    deps.onSuccess()
  }, [amount, destination, selectedTokenKey, tokens, deps, log])

  const errorReason = state.phase === 'error' ? state.errorReason : null

  const flow: SendFlowState = {
    phase,
    tokens,
    selectedToken,
    selectedTokenKey,
    amount,
    destination,
    available,
    symbol,
    isAmountValid: amountValidation.isValid,
    amountInvalidReason,
    isDestinationValid: destinationValidation.isValid,
    destinationInvalidReason,
    walletSuggestions: deps.walletSuggestions,
    recentSuggestions: deps.recentSuggestions,
    canReview,
    errorReason,
    assetsStatus,
    retryAssets: deps.retryAssets,
    selectToken,
    setAmount,
    setAmountToMax,
    setPercent,
    setDestination,
    review,
    back,
    submit: () => void submit(),
    retry,
    reset,
  }

  return { flow, isApplicable }
}
