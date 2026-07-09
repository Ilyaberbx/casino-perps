import { useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import type { ResultAsync } from 'neverthrow'
import type { WalletClient } from 'viem'
import type { ChainSwitchOutcome } from '@/modules/account'
import type { WalletAddress } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { ToastApi } from '@/modules/shared/services/toast'
import type { HyperliquidGatewayError } from '../../gateway/hyperliquid-gateway.types'
import type { HyperEvmCoreService } from '../../services/hyperevm-core-service.types'
import { deriveFlowAssetsStatus } from '../../components/shared-flow/shared-flow.utils'
import type { FlowMetaStatus } from '../../components/shared-flow/shared-flow.types'
import { EvmCoreFlowContext } from './evm-core-flow-provider.context'
import type {
  EvmCoreDirection,
  EvmCoreFlowContextValue,
  EvmCoreFlowState,
  EvmCorePercent,
  EvmCoreToken,
  EvmPreflightStatus,
} from './evm-core-flow-provider.types'
import { INITIAL_EVM_CORE_FLOW_STATE, evmCoreFlowReducer } from './evm-core-flow.reducer'
import {
  evmDecimalsForToken,
  failEvmCore,
  mapEvmServiceErrorToReason,
  mapGatewayErrorToEvmCoreError,
  percentOfAvailable,
  resolveSelectedToken,
  systemAddressForToken,
  toEvmRawAmount,
  validateEvmCoreAmount,
} from './evm-core-flow.utils'

/**
 * The narrowed gateway seam the Core→EVM direction consumes — only `spotSend`.
 * Core→EVM is a `spotSend` to the token's system address (which credits the
 * user's own HyperEVM address); there is no usd path and no external destination.
 */
export interface EvmCoreGateway {
  spotSend(
    masterWallet: WalletClient,
    params: { destination: WalletAddress; token: string; amount: string },
  ): ResultAsync<void, HyperliquidGatewayError>
}

/**
 * Collaborators for the EVM⇄Core machine. Core→EVM signs `spotSend` via the
 * master viem account; EVM→Core broadcasts on HyperEVM via the (Arbitrum-bound)
 * broadcast wallet that the `evmService` switches to HyperEVM at runtime
 * (ADR-0069). Injected so the hook is unit-testable without JSX / Privy.
 */
export interface EvmCoreFlowDeps {
  readonly gateway: EvmCoreGateway
  readonly evmService: HyperEvmCoreService
  /** Master viem account for the user-signed Core→EVM `spotSend` (ADR-0012). */
  readonly getMasterViemAccount: (master: WalletAddress) => Promise<WalletClient | null>
  /** Broadcast wallet for the on-chain EVM→Core tx + the post-switch chain re-read. */
  readonly getBroadcastWalletClient: (master: WalletAddress) => Promise<WalletClient | null>
  /**
   * Privy-native chain switch to HyperEVM (ADR-0080). Replaces the raw-provider
   * `evmService.switchToHyperEvm` that silently no-ops for the embedded wallet.
   */
  readonly switchMasterWalletChain: (master: WalletAddress, chainId: number) => Promise<ChainSwitchOutcome>
  /** The resolved Selected-Wallet master address. `null` → submit aborts; drives `isApplicable`. */
  readonly masterAddress: WalletAddress | null
  /** Core→EVM token list — the held EVM-linked HyperCore holdings. */
  readonly coreTokens: ReadonlyArray<EvmCoreToken>
  /** EVM→Core token list — the full EVM-linked token universe (balances read per selection). */
  readonly evmTokens: ReadonlyArray<EvmCoreToken>
  /** HyperEVM chain id for the wrong-chain preflight check. */
  readonly hyperEvmChainId: number
  /** Builds the explorer tx URL for a mined HyperEVM hash. */
  readonly explorerTxUrl: (hash: string) => string
  /** The spot-meta fetch status — drives the picker's loading / error state. */
  readonly metaStatus: FlowMetaStatus
  /** Re-run the spot-meta fetch (the picker's `error`-state retry). */
  readonly retryAssets: () => void
  readonly toast: ToastApi
  readonly onSuccess: () => void
  readonly logger: Logger
}

/** Internal: read the context value, asserting the provider is mounted. */
export function useEvmCoreFlowContext(): EvmCoreFlowContextValue {
  const ctx = useContext(EvmCoreFlowContext)
  if (!ctx) throw new Error('useEvmCoreFlow must be used inside <EvmCoreFlowProvider>')
  return ctx
}

/** The rich machine state the dumb body consumes. */
export function useEvmCoreFlow(): EvmCoreFlowState {
  return useEvmCoreFlowContext().flow
}

const SUCCESS_TOAST_TITLE = 'Transfer submitted'

export function useOwnEvmCoreFlow(deps: EvmCoreFlowDeps): EvmCoreFlowContextValue {
  const log = useMemo(
    () => deps.logger.child({ module: 'hyperliquid-evm-core-flow' }),
    [deps.logger],
  )

  const [state, dispatch] = useReducer(evmCoreFlowReducer, INITIAL_EVM_CORE_FLOW_STATE)
  const { phase, direction, selectedTokenKey, amount, amountTouched } = state

  const isEvmToCore = direction === 'evm-to-core'
  const tokens = isEvmToCore ? deps.evmTokens : deps.coreTokens
  const selectedToken = useMemo(
    () => resolveSelectedToken(tokens, selectedTokenKey),
    [tokens, selectedTokenKey],
  )

  // EVM-side preflight (only the `evm-to-core` direction). `ready` is the default
  // so the Core→EVM path never gates on it. The effect below resolves the real
  // status from the on-chain reads when the direction is EVM→Core.
  const [evmPreflight, setEvmPreflight] = useState<EvmPreflightStatus>('ready')
  const [evmAvailable, setEvmAvailable] = useState(0)
  const [evmRefreshNonce, setEvmRefreshNonce] = useState(0)

  const selectedTokenKeyResolved = selectedToken?.key ?? ''
  const masterAddress = deps.masterAddress
  const evmService = deps.evmService
  const getBroadcastWalletClient = deps.getBroadcastWalletClient
  const switchMasterWalletChain = deps.switchMasterWalletChain
  const hyperEvmChainId = deps.hyperEvmChainId

  useEffect(() => {
    const shouldPreflight = isEvmToCore && phase === 'form' && selectedToken !== null
    let cancelled = false
    // Defer every setState a microtask so none lands synchronously inside the
    // effect body (react-hooks/set-state-in-effect) — mirrors the deposit preflight.
    if (!shouldPreflight || masterAddress === null) {
      void Promise.resolve().then(() => {
        if (!cancelled) setEvmPreflight('ready')
      })
      return () => {
        cancelled = true
      }
    }
    void Promise.resolve()
      .then(() => {
        if (cancelled) return undefined
        setEvmPreflight('checking')
        return runEvmPreflight({
          evmService,
          getBroadcastWalletClient,
          masterAddress,
          hyperEvmChainId,
          token: selectedToken,
          log,
        })
      })
      .then((result) => {
        if (cancelled || result === undefined) return
        setEvmPreflight(result.status)
        setEvmAvailable(result.available)
      })
    return () => {
      cancelled = true
    }
    // selectedToken is captured via selectedTokenKeyResolved; re-run on token/direction/phase/nonce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEvmToCore,
    phase,
    selectedTokenKeyResolved,
    masterAddress,
    evmRefreshNonce,
    evmService,
    getBroadcastWalletClient,
    hyperEvmChainId,
  ])

  const available = isEvmToCore ? evmAvailable : (selectedToken?.available ?? 0)
  const symbol = selectedToken?.symbol ?? ''
  const decimals = selectedToken
    ? isEvmToCore
      ? evmDecimalsForToken(selectedToken)
      : selectedToken.decimals
    : 0

  const amountValidation = useMemo(
    () => validateEvmCoreAmount(amount, available, decimals),
    [amount, available, decimals],
  )
  const amountInvalidReason = amountTouched ? amountValidation.reason : null

  const hasSelectedToken = selectedToken !== null
  const isEvmReady = !isEvmToCore || evmPreflight === 'ready'
  const canReview = hasSelectedToken && amountValidation.isValid && isEvmReady

  const isApplicable = masterAddress !== null && tokens.length > 0
  const assetsStatus = deriveFlowAssetsStatus(deps.metaStatus, tokens.length)

  const setDirection = useCallback(
    (next: EvmCoreDirection) => dispatch({ type: 'DIRECTION_CHANGED', direction: next }),
    [],
  )
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
    (percent: EvmCorePercent) =>
      dispatch({
        type: 'AMOUNT_CHANGED',
        amount: percentOfAvailable(percent, available, decimals),
      }),
    [available, decimals],
  )
  const review = useCallback(() => {
    if (!canReview) return
    log.info({}, 'evm-core review')
    dispatch({ type: 'REVIEWED' })
  }, [canReview, log])
  const back = useCallback(() => dispatch({ type: 'BACK' }), [])
  const retry = useCallback(() => {
    log.info({}, 'evm-core retry')
    dispatch({ type: 'RETRY' })
  }, [log])
  const reset = useCallback(() => {
    const fallbackKey = tokens[0]?.key ?? INITIAL_EVM_CORE_FLOW_STATE.selectedTokenKey
    dispatch({ type: 'RESET', selectedTokenKey: fallbackKey })
  }, [tokens])

  const switchChain = useCallback(async () => {
    if (masterAddress === null) {
      // No wallet to switch with — surface a visible error card, not silence.
      failEvmCore(log, dispatch, 'unknown', { reason: 'wallet-unavailable' }, 'evm-core switch aborted')
      return
    }
    log.info({}, 'evm-core switch requested')
    // Privy-native switch (ADR-0080) — the raw-provider switch silently no-ops for
    // the embedded wallet.
    const outcome = await switchMasterWalletChain(masterAddress, hyperEvmChainId)
    // A rejected switch is non-destructive: stay on the wrong-chain preflight
    // (re-read via the nonce bump) instead of landing an error card.
    if (outcome === 'rejected') {
      log.info({ reason: 'wallet-rejected' }, 'evm-core switch rejected')
      setEvmRefreshNonce((n) => n + 1)
      return
    }
    if (outcome === 'failed') {
      failEvmCore(log, dispatch, 'chain-switch-failed', {}, 'evm-core switch failed')
      return
    }
    // Privy resolved the switch, but resolution is NOT proof it took effect (the
    // embedded-wallet no-op). Re-read the chain via a FRESH broadcast client (Privy
    // does not update existing providers) and only proceed when it actually
    // changed; otherwise surface an error so the dead-button loop can't recur
    // (ADR-0080 D-3).
    const isOnHyperEvm = await readIsOnHyperEvm(
      getBroadcastWalletClient,
      evmService,
      masterAddress,
      hyperEvmChainId,
    )
    if (!isOnHyperEvm) {
      failEvmCore(log, dispatch, 'chain-switch-failed', { reason: 'switch-no-op' }, 'evm-core switch did not change chain')
      return
    }
    log.info({}, 'evm-core switched to hyperevm')
    setEvmRefreshNonce((n) => n + 1)
  }, [masterAddress, switchMasterWalletChain, getBroadcastWalletClient, evmService, hyperEvmChainId, log])

  const submitCoreToEvm = useCallback(
    async (token: EvmCoreToken, value: number, wallet: WalletClient) => {
      const destination = systemAddressForToken(token)
      const result = await deps.gateway.spotSend(wallet, {
        destination,
        token: token.tokenId,
        amount: value.toString(),
      })
      if (result.isErr()) {
        const { kind, message } = result.error
        failEvmCore(log, dispatch, mapGatewayErrorToEvmCoreError(kind), { kind, errorMessage: message }, 'evm-core failed')
        return
      }
      log.info({}, 'evm-core core→evm succeeded')
      dispatch({ type: 'SENT', transactionHash: null })
      deps.toast.show({
        variant: 'success',
        title: SUCCESS_TOAST_TITLE,
        description: `Moving ${value} ${token.symbol} to HyperEVM.`,
      })
      deps.onSuccess()
    },
    [deps, log],
  )

  const submitEvmToCore = useCallback(
    async (token: EvmCoreToken, value: number, wallet: WalletClient) => {
      const systemAddress = systemAddressForToken(token)
      const rawAmount = toEvmRawAmount(value, evmDecimalsForToken(token))
      const isErc20 = !token.isHype
      const missingContract = isErc20 && token.evmAddress === null
      if (missingContract) {
        failEvmCore(log, dispatch, 'unknown', { reason: 'no-evm-contract' }, 'evm-core aborted')
        return
      }
      const result =
        token.isHype || token.evmAddress === null
          ? await deps.evmService.sendNativeHype(wallet, { to: systemAddress, weiAmount: rawAmount })
          : await deps.evmService.transferErc20(wallet, {
              contract: token.evmAddress,
              systemAddress,
              rawAmount,
            })
      if (result.isErr()) {
        const { kind, message } = result.error
        failEvmCore(log, dispatch, mapEvmServiceErrorToReason(kind), { kind, errorMessage: message }, 'evm-core failed')
        return
      }
      log.info({}, 'evm-core evm→core succeeded')
      dispatch({ type: 'SENT', transactionHash: result.value.transactionHash })
      deps.toast.show({
        variant: 'success',
        title: SUCCESS_TOAST_TITLE,
        description: `Moving ${value} ${token.symbol} to HyperCore.`,
      })
      deps.onSuccess()
    },
    [deps, log],
  )

  const submit = useCallback(async () => {
    log.info({ direction }, 'evm-core submit')
    const token = resolveSelectedToken(tokens, selectedTokenKey)
    if (token === null) {
      failEvmCore(log, dispatch, 'unknown', { reason: 'no-token' }, 'evm-core aborted — no token')
      return
    }
    const validated = validateEvmCoreAmount(amount, available, decimals)
    if (!validated.isValid) {
      const reason =
        validated.reason === 'Amount exceeds available balance'
          ? 'insufficient-balance'
          : 'amount-invalid'
      failEvmCore(log, dispatch, reason, { reason: validated.reason }, 'evm-core validation failed')
      return
    }
    const master = masterAddress
    const resolveWallet = isEvmToCore ? deps.getBroadcastWalletClient : deps.getMasterViemAccount
    const wallet = master === null ? null : await resolveWallet(master)
    if (wallet === null) {
      failEvmCore(log, dispatch, 'unknown', { reason: 'wallet-unavailable' }, 'evm-core aborted')
      return
    }
    dispatch({ type: 'SUBMITTED' })
    if (isEvmToCore) {
      await submitEvmToCore(token, validated.value, wallet)
      return
    }
    await submitCoreToEvm(token, validated.value, wallet)
  }, [
    amount,
    available,
    decimals,
    direction,
    isEvmToCore,
    masterAddress,
    selectedTokenKey,
    tokens,
    deps,
    log,
    submitCoreToEvm,
    submitEvmToCore,
  ])

  const errorReason = state.phase === 'error' ? state.errorReason : null
  const transactionHash = state.phase === 'sent' ? state.transactionHash : null
  const explorerTxUrl = transactionHash === null ? null : deps.explorerTxUrl(transactionHash)

  const flow: EvmCoreFlowState = {
    phase,
    direction,
    tokens,
    selectedToken,
    selectedTokenKey,
    amount,
    available,
    symbol,
    isAmountValid: amountValidation.isValid,
    amountInvalidReason,
    canReview,
    errorReason,
    evmPreflight,
    assetsStatus,
    transactionHash,
    explorerTxUrl,
    setDirection,
    retryAssets: deps.retryAssets,
    switchChain: () => void switchChain(),
    selectToken,
    setAmount,
    setAmountToMax,
    setPercent,
    review,
    back,
    submit: () => void submit(),
    retry,
    reset,
  }

  return { flow, isApplicable }
}

/**
 * Post-switch verification (ADR-0080 D-3): read the live chain via a FRESH
 * broadcast client — Privy's `switchChain` does not update already-built
 * providers, so the previous client would report the stale chain. Returns whether
 * the wallet is now on HyperEVM. A missing wallet or a read failure resolves to
 * `false` (treated as "did not switch" → the caller surfaces an error).
 */
async function readIsOnHyperEvm(
  getBroadcastWalletClient: (master: WalletAddress) => Promise<WalletClient | null>,
  evmService: HyperEvmCoreService,
  masterAddress: WalletAddress,
  hyperEvmChainId: number,
): Promise<boolean> {
  const wallet = await getBroadcastWalletClient(masterAddress).catch(() => null)
  if (wallet === null) return false
  const chainResult = await evmService.readChainId(wallet)
  return chainResult.isOk() && chainResult.value === hyperEvmChainId
}

interface EvmPreflightInput {
  readonly evmService: HyperEvmCoreService
  readonly getBroadcastWalletClient: (master: WalletAddress) => Promise<WalletClient | null>
  readonly masterAddress: WalletAddress
  readonly hyperEvmChainId: number
  readonly token: EvmCoreToken
  readonly log: Logger
}

/**
 * Resolve the EVM→Core preflight for the selected token: chain (must be
 * HyperEVM), gas (native HYPE > 0), then the token's EVM balance. Returns the
 * status + the available EVM balance. A read failure resolves to `checking` so
 * the form stays gated (the user can re-select / switch to retry).
 */
async function runEvmPreflight(input: EvmPreflightInput): Promise<{
  status: EvmPreflightStatus
  available: number
}> {
  const { evmService, getBroadcastWalletClient, masterAddress, hyperEvmChainId, token, log } = input
  const wallet = await getBroadcastWalletClient(masterAddress).catch(() => null)
  if (wallet === null) return { status: 'checking', available: 0 }

  const chainResult = await evmService.readChainId(wallet)
  if (chainResult.isErr()) {
    log.warn({ kind: chainResult.error.kind }, 'evm-core preflight chain read failed')
    return { status: 'checking', available: 0 }
  }
  const isWrongChain = chainResult.value !== hyperEvmChainId
  if (isWrongChain) return { status: 'wrong-chain', available: 0 }

  const gasResult = await evmService.readNativeBalance(masterAddress)
  if (gasResult.isErr()) {
    log.warn({ kind: gasResult.error.kind }, 'evm-core preflight gas read failed')
    return { status: 'checking', available: 0 }
  }
  const hasNoGas = gasResult.value <= 0
  if (hasNoGas) return { status: 'no-gas', available: 0 }

  if (token.isHype || token.evmAddress === null) {
    return { status: 'ready', available: gasResult.value }
  }
  const balanceResult = await evmService.readErc20Balance(
    token.evmAddress,
    masterAddress,
    evmDecimalsForToken(token),
  )
  if (balanceResult.isErr()) {
    log.warn({ kind: balanceResult.error.kind }, 'evm-core preflight balance read failed')
    return { status: 'checking', available: 0 }
  }
  return { status: 'ready', available: balanceResult.value }
}
