import { useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import type { WalletClient } from 'viem'
import type {
  AccountModeReader,
  Balance,
  BalancesReader,
  WalletAddress,
} from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { ToastApi } from '@/modules/shared/services/toast'
import type { TransferPrefill } from '@/modules/shared/providers/transfer-sheet-provider'
import type { HyperliquidGatewayError } from '../../gateway/hyperliquid-gateway.types'
import { USDC_SYMBOL } from '../../hyperliquid.constants'
import { TransferFlowContext } from './transfer-flow-provider.context'
import type {
  TransferAccount,
  TransferFlowContextValue,
  TransferFlowState,
} from './transfer-flow-provider.types'
import {
  INITIAL_TRANSFER_FLOW_STATE,
  transferFlowReducer,
} from './transfer-flow.reducer'
import {
  failTransfer,
  mapGatewayErrorToTransferError,
  oppositeAccount,
  validateTransferAmount,
} from './transfer-flow.utils'

/**
 * The single transfer-gateway seam the flow consumes. A narrowed view of the
 * exchange gateway — only `usdClassTransfer` — so tests inject a one-method fake.
 */
export interface TransferGateway {
  usdClassTransfer(
    masterWallet: WalletClient,
    params: { amount: string; toPerp: boolean },
  ): import('neverthrow').ResultAsync<void, HyperliquidGatewayError>
}

/**
 * Collaborators for the transfer machine. Injected so the hook is unit-testable
 * without JSX / Privy: tests supply a fake gateway, a fake balances reader, a
 * fake accountMode reader, a stub master-wallet accessor, and a fake toast.
 */
export interface TransferFlowDeps {
  readonly gateway: TransferGateway
  /** The active venue's live balances reader (USDC available per account). */
  readonly balances: BalancesReader | null
  /** The active venue's accountMode reader (drives `isApplicable`). */
  readonly accountMode: AccountModeReader | null
  /**
   * Resolves the master wallet for the user-signed action (ADR-0012). ADR-0060:
   * takes the resolved Selected-Wallet `master` address (embedded included) so the
   * transfer signs as the Selected Wallet, not the Privy-canonical primary wallet.
   */
  readonly getMasterViemAccount: (master: WalletAddress) => Promise<WalletClient | null>
  /**
   * The resolved Selected-Wallet master address (`useSelectedWallet().masterAddress`).
   * `null` when no wallet resolves — `submit` aborts before signing.
   */
  readonly masterAddress: WalletAddress | null
  /** Imperative toast API (injected for deterministic tests). */
  readonly toast: ToastApi
  /** Called on optimistic success to close the host sheet. */
  readonly onSuccess: () => void
  readonly logger: Logger
  /** Opening hint — when present, seeds the initial `from` direction. */
  readonly prefill?: TransferPrefill | null
}

/** Internal: read the context value, asserting the provider is mounted. */
export function useTransferFlowContext(): TransferFlowContextValue {
  const ctx = useContext(TransferFlowContext)
  if (!ctx) throw new Error('useTransferFlow must be used inside <TransferFlowProvider>')
  return ctx
}

/** The rich machine state the dumb body consumes. */
export function useTransferFlow(): TransferFlowState {
  return useTransferFlowContext().flow
}

const SUCCESS_TOAST_TITLE = 'Transfer complete'

export function useOwnTransferFlow(deps: TransferFlowDeps): TransferFlowContextValue {
  const log = useMemo(
    () => deps.logger.child({ module: 'hyperliquid-transfer-flow' }),
    [deps.logger],
  )

  const initialFrom: TransferAccount = deps.prefill?.from ?? INITIAL_TRANSFER_FLOW_STATE.from
  const [state, dispatch] = useReducer(transferFlowReducer, {
    ...INITIAL_TRANSFER_FLOW_STATE,
    from: initialFrom,
  })
  const { phase, from, amount, amountTouched } = state
  const to = oppositeAccount(from)

  // Track the live available USDC for both accounts. Spot→Perp MAX is the spot
  // USDC row's `available` (total − hold); Perp→Spot MAX is the perps USDC row's
  // `available` (withdrawable). Subscribe to both scopes once and re-read.
  const [spotAvailable, setSpotAvailable] = useReducer(
    (_prev: number, next: number) => next,
    0,
  )
  const [perpsAvailable, setPerpsAvailable] = useReducer(
    (_prev: number, next: number) => next,
    0,
  )

  const balances = deps.balances
  useEffect(() => {
    if (!balances) return
    const unsubSpot = balances.subscribe('all', (rows) =>
      setSpotAvailable(readUsdcAvailable(rows)),
    )
    const unsubPerps = balances.subscribe('perps', (rows) =>
      setPerpsAvailable(readUsdcAvailable(rows)),
    )
    return () => {
      unsubSpot()
      unsubPerps()
    }
  }, [balances])

  const accountMode = deps.accountMode
  const [isApplicable, setIsApplicable] = useReducer(
    (_prev: boolean, next: boolean) => next,
    accountMode?.current().isSegregated ?? true,
  )
  useEffect(() => {
    if (!accountMode) {
      setIsApplicable(true)
      return
    }
    setIsApplicable(accountMode.current().isSegregated)
    return accountMode.subscribe((mode) => setIsApplicable(mode.isSegregated))
  }, [accountMode])

  const available = from === 'spot' ? spotAvailable : perpsAvailable

  const validation = useMemo(
    () => validateTransferAmount(amount, available),
    [amount, available],
  )
  const amountInvalidReason = amountTouched ? validation.reason : null

  const setAmount = useCallback(
    (next: string) => dispatch({ type: 'AMOUNT_CHANGED', amount: next }),
    [],
  )
  const setAmountToMax = useCallback(
    () => dispatch({ type: 'AMOUNT_CHANGED', amount: available > 0 ? available.toString() : '' }),
    [available],
  )
  const swap = useCallback(() => dispatch({ type: 'SWAPPED' }), [])
  const retry = useCallback(() => {
    log.info({}, 'transfer retry')
    dispatch({ type: 'RETRY' })
  }, [log])

  const submit = useCallback(async () => {
    const toPerp = oppositeAccount(from) === 'perps'
    log.info({ from, toPerp }, 'transfer submit')
    const validated = validateTransferAmount(amount, available)
    if (!validated.isValid) {
      const reason = validated.reason === 'Amount exceeds available balance'
        ? 'insufficient-balance'
        : 'amount-invalid'
      failTransfer(log, dispatch, reason, { reason: validated.reason }, 'transfer validation failed')
      return
    }
    const master = deps.masterAddress
    const wallet = master === null ? null : await deps.getMasterViemAccount(master)
    if (wallet === null) {
      failTransfer(log, dispatch, 'unknown', { reason: 'wallet-unavailable' }, 'transfer aborted')
      return
    }
    dispatch({ type: 'SUBMITTED' })
    const result = await deps.gateway.usdClassTransfer(wallet, {
      amount: validated.value.toString(),
      toPerp,
    })
    if (result.isErr()) {
      const { kind, message } = result.error
      const reason = mapGatewayErrorToTransferError(kind)
      failTransfer(log, dispatch, reason, { kind, errorMessage: message }, 'transfer failed')
      return
    }
    log.info({ from, toPerp }, 'transfer succeeded')
    dispatch({ type: 'SUCCEEDED' })
    deps.toast.show({
      variant: 'success',
      title: SUCCESS_TOAST_TITLE,
      description: `Moved ${validated.value} USDC to ${toPerp ? 'Perps' : 'Spot'}.`,
    })
    deps.onSuccess()
  }, [from, amount, available, deps, log])

  const errorReason = state.phase === 'error' ? state.errorReason : null

  const flow: TransferFlowState = {
    phase,
    from,
    to,
    amount,
    available,
    isAmountValid: validation.isValid,
    amountInvalidReason,
    errorReason,
    setAmount,
    setAmountToMax,
    swap,
    submit: () => void submit(),
    retry,
  }

  return { flow, isApplicable }
}

/** Read the USDC row's available balance from a balances projection, or 0. */
function readUsdcAvailable(rows: ReadonlyArray<Balance>): number {
  const usdc = rows.find((row) => row.asset === USDC_SYMBOL)
  return usdc?.available ?? 0
}
