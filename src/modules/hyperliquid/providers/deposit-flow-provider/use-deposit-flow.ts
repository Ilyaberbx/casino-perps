import { useCallback, useContext, useEffect, useReducer, useRef } from 'react'
import type { WalletClient } from 'viem'
import type { ChainSwitchOutcome, WalletSource } from '@/modules/account'
import type { PortfolioReader, WalletAddress } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { HyperliquidDepositService } from '../../services/hyperliquid-deposit-service.types'
import { ARBITRUM_CHAIN_ID } from '../../services/hyperliquid-deposit.constants'
import { DepositFlowContext } from './deposit-flow-provider.context'
import type { DepositFlowState } from './deposit-flow-provider.types'
import { WALLET_BALANCE_POLL_MS } from './deposit-flow.constants'
import { depositFlowReducer, INITIAL_DEPOSIT_FLOW_STATE } from './deposit-flow.reducer'
import {
  describeCause,
  defaultNewDepositId,
  failWith,
  globalClearInterval,
  globalSetInterval,
  mapErrorToReason,
  validateAmount,
} from './deposit-flow.utils'
import { useCreditWatch } from './use-credit-watch'
import { useDepositAmount } from './use-deposit-amount'
import { useDepositId } from './use-deposit-id'
import { useDepositPreflight } from './use-deposit-preflight'
import { useFundingPoll } from './use-funding-poll'

export { WALLET_BALANCE_POLL_MS } from './deposit-flow.constants'

/**
 * Collaborators for the deposit machine. Injected so the hook is unit-testable
 * without JSX / Privy: tests supply a fake service, a fake portfolio reader, a
 * stub address + broadcast accessor, and fake timers (testing.md /
 * websocket-streaming.md — never real timers).
 */
export interface DepositFlowDeps {
  readonly service: HyperliquidDepositService
  /** The active venue's live account-value reader (phase-2 completion source). */
  readonly portfolioReader: PortfolioReader | null
  /**
   * The deposit master address — the resolved Selected-Wallet master (ADR-0060),
   * embedded included. Used as the broadcast wallet's address AND the balance-read
   * target (the master's USDC/ETH-for-gas on Arbitrum).
   */
  readonly address: WalletAddress | null
  /**
   * Resolves the broadcast wallet for the deposit (ADR-0028; ADR-0060). TAKES the
   * resolved Selected-Wallet `master` address so the embedded/imported selected
   * wallet signs + broadcasts, not the Privy-canonical primary wallet.
   */
  readonly getBroadcastWalletClient: (master: WalletAddress) => Promise<WalletClient | null>
  /**
   * Privy-native chain switch to Arbitrum (ADR-0080). Replaces the raw-provider
   * `service.switchToArbitrum` that silently no-ops for the embedded wallet.
   */
  readonly switchMasterWalletChain: (master: WalletAddress, chainId: number) => Promise<ChainSwitchOutcome>
  /**
   * The Primary Wallet's source. Only `external` wallets populate
   * `getBroadcastWalletClient` late (injected re-hydration after a page load);
   * embedded-only users never resolve one, so the preflight must NOT wait on
   * them — see `isBroadcastWalletReady`.
   */
  readonly walletSource: WalletSource | null
  /**
   * Whether the external broadcast wallet is resolvable right now. The preflight
   * waits in `checking` while an external wallet is still re-hydrating rather than
   * aborting `wallet-unavailable` on first open; it self-heals when this flips true.
   */
  readonly isBroadcastWalletReady: boolean
  readonly logger: Logger
  /**
   * Mints the per-attempt correlation id bound onto every flow log record.
   * Injected so tests stay deterministic; defaults to `crypto.randomUUID()`.
   */
  readonly newDepositId?: () => string
  readonly pollIntervalMs?: number
  readonly setInterval?: (handler: () => void, ms: number) => number
  readonly clearInterval?: (handle: number) => void
}

// ---------------------------------------------------------------------------
// Consumer hooks — thin context reads
// ---------------------------------------------------------------------------

/**
 * Internal: read the rich state, asserting the provider is mounted. Both public
 * consumer hooks (`useDepositFlow` here, `useHyperliquidDeposit`) project from
 * this one presence-checked read (IN-DF-05).
 */
export function useDepositFlowContext(): DepositFlowState {
  const ctx = useContext(DepositFlowContext)
  if (!ctx) throw new Error('useDepositFlow must be used inside <DepositFlowProvider>')
  return ctx
}

/** The rich machine state the dumb body consumes. */
export function useDepositFlow(): DepositFlowState {
  return useDepositFlowContext()
}

// ---------------------------------------------------------------------------
// Smart hook — thin composer over the per-concern hooks
// ---------------------------------------------------------------------------

export function useOwnDepositFlow(deps: DepositFlowDeps): DepositFlowState {
  const [state, dispatch] = useReducer(depositFlowReducer, INITIAL_DEPOSIT_FLOW_STATE)
  const { phase, walletUsdc, amount, amountTouched } = state

  const { log, preflightNonce, bumpPreflight, startNewAttempt } = useDepositId(
    deps.logger,
    deps.newDepositId ?? defaultNewDepositId,
  )

  // Emit the `debug` phase trace `{ from, to }` on every phase change. The
  // reducer's previous state gives `from` for free — a `prevPhaseRef` mirror is
  // synced after each change so the next one logs against the right origin.
  const prevPhaseRef = useRef(phase)
  useEffect(() => {
    const isUnchanged = prevPhaseRef.current === phase
    if (isUnchanged) return
    log.debug({ from: prevPhaseRef.current, to: phase }, 'phase')
    prevPhaseRef.current = phase
  }, [phase, log])

  const { resolveWallet } = useDepositPreflight({
    service: deps.service,
    address: deps.address,
    getBroadcastWalletClient: deps.getBroadcastWalletClient,
    walletSource: deps.walletSource,
    isBroadcastWalletReady: deps.isBroadcastWalletReady,
    log,
    preflightNonce,
    dispatch,
  })

  useFundingPoll({
    phase,
    service: deps.service,
    address: deps.address,
    log,
    pollMs: deps.pollIntervalMs ?? WALLET_BALANCE_POLL_MS,
    setIntervalFn: deps.setInterval ?? globalSetInterval,
    clearIntervalFn: deps.clearInterval ?? globalClearInterval,
    dispatch,
  })

  const { captureBaseline } = useCreditWatch({
    phase,
    portfolioReader: deps.portfolioReader,
    log,
    dispatch,
  })

  const { validation, amountInvalidReason, setAmount, setAmountToMax } = useDepositAmount(
    amount,
    walletUsdc,
    amountTouched,
    dispatch,
  )

  const { address: masterAddress, switchMasterWalletChain } = deps
  const switchChain = useCallback(async () => {
    if (masterAddress === null) {
      failWith(log, dispatch, 'unknown', { reason: 'wallet-unavailable' }, 'chain switch aborted')
      return
    }
    log.info({}, 'chain switch requested')
    // Privy-native switch (ADR-0080) — the raw-provider switch silently no-ops for
    // the embedded wallet.
    const outcome = await switchMasterWalletChain(masterAddress, ARBITRUM_CHAIN_ID)
    // A rejected switch is non-destructive: return to wrong-chain, no error card.
    if (outcome === 'rejected') {
      log.info({ reason: 'wallet-rejected' }, 'chain switch rejected')
      dispatch({ type: 'SWITCH_REJECTED' })
      return
    }
    if (outcome === 'failed') {
      failWith(log, dispatch, 'chain-switch-failed', {}, 'chain switch failed')
      return
    }
    // Privy resolved the switch, but resolution is NOT proof it took effect (the
    // embedded-wallet no-op). Re-read the chain via a FRESH broadcast client (Privy
    // does not update existing providers) and only proceed when it actually
    // changed; otherwise surface an error (ADR-0080 D-3).
    const wallet = await resolveWallet()
    if (wallet === null) {
      failWith(log, dispatch, 'chain-switch-failed', { reason: 'switch-no-op' }, 'chain switch did not change chain')
      return
    }
    const chainRead = await deps.service.readChainId(wallet)
    const isOnArbitrum = chainRead.isOk() && chainRead.value === ARBITRUM_CHAIN_ID
    if (!isOnArbitrum) {
      failWith(log, dispatch, 'chain-switch-failed', { reason: 'switch-no-op' }, 'chain switch did not change chain')
      return
    }
    log.info({ to: ARBITRUM_CHAIN_ID }, 'chain switched')
    // Re-resolve the branch with the same depositId (same journey).
    bumpPreflight()
  }, [masterAddress, switchMasterWalletChain, deps.service, log, resolveWallet, bumpPreflight])

  const submit = useCallback(async () => {
    log.info({ amount }, 'deposit submit')
    const validated = validateAmount(amount, walletUsdc)
    if (!validated.isValid) {
      const fields = { amount, walletUsdc, reason: validated.reason }
      failWith(log, dispatch, 'insufficient-balance', fields, 'deposit validation failed')
      return
    }
    const wallet = await resolveWallet()
    if (wallet === null) {
      failWith(log, dispatch, 'unknown', { reason: 'wallet-unavailable' }, 'deposit aborted')
      return
    }
    // CR-02: capture the credit target from the PRE-broadcast account value, so
    // phase-2 detects THIS deposit landing. `validated.value` is the parsed
    // amount — `submit` never re-parses the string (WR-DF-06).
    captureBaseline(validated.value)
    dispatch({ type: 'SUBMITTED' })
    const result = await deps.service.transfer(wallet, validated.value)
    if (result.isErr()) {
      const { kind, message, cause } = result.error
      const reason = mapErrorToReason(kind)
      // wallet-rejected returns non-destructively to `ready` with amount kept.
      const isUserRejection = reason === 'wallet-rejected'
      if (isUserRejection) {
        log.info({}, 'transfer rejected')
        dispatch({ type: 'TRANSFER_REJECTED' })
        return
      }
      const fields = { kind, errorMessage: message, cause: describeCause(cause) }
      failWith(log, dispatch, reason, fields, 'transfer failed')
      return
    }
    log.info({ transactionHash: result.value.transactionHash }, 'transfer sent')
    dispatch({ type: 'TRANSFER_SENT', transactionHash: result.value.transactionHash })
  }, [amount, walletUsdc, deps.service, log, resolveWallet, captureBaseline])

  const retry = useCallback(() => {
    log.info({}, 'deposit retry')
    // Fresh attempt → fresh correlation id; pre-flight re-runs only after the new
    // id commits, so the retried attempt's logs carry the new id.
    dispatch({ type: 'RETRY' })
    startNewAttempt()
  }, [log, startNewAttempt])

  // Flatten the phase-discriminated slice back to the nullable `DepositFlowState`
  // contract the body consumes: an `errorReason` only exists on `error`, a
  // `transactionHash` only on `sent | credited`.
  const errorReason = state.phase === 'error' ? state.errorReason : null
  const hasTransactionHash = state.phase === 'sent' || state.phase === 'credited'
  const transactionHash: `0x${string}` | null = hasTransactionHash
    ? state.transactionHash
    : null

  return {
    phase,
    walletUsdc,
    amount,
    isAmountValid: validation.isValid,
    amountInvalidReason,
    errorReason,
    transactionHash,
    setAmount,
    setAmountToMax,
    switchChain: () => void switchChain(),
    submit: () => void submit(),
    retry,
  }
}
