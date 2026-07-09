import type { PortfolioReader } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import { scrubAddresses } from '@/modules/shared/logger'
import type { HyperliquidDepositErrorKind } from '../../services/hyperliquid-deposit-service.types'
import {
  ARBITRUM_CHAIN_ID,
  MIN_DEPOSIT_USDC,
} from '../../services/hyperliquid-deposit.constants'
import type {
  DepositBranchPhase,
  DepositFlowAction,
  DepositFlowErrorReason,
} from './deposit-flow-provider.types'

export type AmountValidation =
  | { readonly isValid: false; readonly reason: string; readonly value: null }
  | { readonly isValid: true; readonly reason: null; readonly value: number }

/**
 * Validate the entered USDC `amount` string against the live wallet balance.
 * Valid when it parses to a finite number in `[MIN_DEPOSIT_USDC, walletUsdc]`.
 * Empty / unparseable / out-of-range each get a plain reason string (conveyed
 * as text, not colour alone — a11y). On success it returns the parsed numeric
 * `value` so the caller transfers exactly what was validated and never re-parses
 * the string (WR-DF-06).
 */
export function validateAmount(amount: string, walletUsdc: number): AmountValidation {
  const trimmed = amount.trim()
  if (trimmed === '') return { isValid: false, reason: 'Enter an amount', value: null }

  const parsed = Number(trimmed)
  const isNumeric = Number.isFinite(parsed) && trimmed !== '-'
  if (!isNumeric) return { isValid: false, reason: 'Enter a valid number', value: null }

  const isBelowMin = parsed < MIN_DEPOSIT_USDC
  if (isBelowMin) {
    return { isValid: false, reason: `Minimum deposit is ${MIN_DEPOSIT_USDC} USDC`, value: null }
  }

  const exceedsBalance = parsed > walletUsdc
  if (exceedsBalance) {
    return { isValid: false, reason: 'Amount exceeds wallet balance', value: null }
  }

  return { isValid: true, reason: null, value: parsed }
}

/** Does the live wallet balance clear the deposit minimum? */
export function hasFundingForDeposit(walletUsdc: number): boolean {
  return walletUsdc >= MIN_DEPOSIT_USDC
}

/**
 * Read the reader's current account value synchronously. The HL portfolio
 * reader emits the current snapshot synchronously on `subscribeSnapshot` (see
 * `emitCurrent` in `portfolio-reader.ts`); we subscribe-and-immediately-unsub
 * to sample it. Returns `null` when no reader exists or no snapshot is cached
 * yet (e.g. the stream has not yet produced a value) — the caller then skips
 * the credit-target capture (CR-02).
 */
export function readCurrentAccountValue(reader: PortfolioReader | null): number | null {
  if (reader === null) return null
  let current: number | null = null
  const unsubscribe = reader.subscribeSnapshot('all', (snapshot) => {
    current = snapshot.accountValue
  })
  unsubscribe()
  return current
}

/**
 * Resolve the live on-chain reality into the single possible deposit branch.
 * Chain mismatch is checked first (hard-gate to 42161 before any other action),
 * then funding, then gas. Pure — the hook calls `setPhase` with the result.
 */
export function resolveBranchPhase(
  usdc: number,
  ethForGas: number,
  chainId: number,
): DepositBranchPhase {
  const isWrongChain = chainId !== ARBITRUM_CHAIN_ID
  if (isWrongChain) return 'wrong-chain'

  const isUnderFunded = !hasFundingForDeposit(usdc)
  if (isUnderFunded) return 'needs-funding'

  const hasNoGas = ethForGas <= 0
  if (hasNoGas) return 'no-gas'

  return 'ready'
}

/**
 * Map a deposit-service error kind to the flow's user-facing reason. Typed
 * against `HyperliquidDepositErrorKind` (not a re-declared literal union) so a
 * new service kind is a typecheck failure here rather than silent drift
 * (IN-DF-01). The `never` arm proves exhaustiveness.
 */
export function mapErrorToReason(kind: HyperliquidDepositErrorKind): DepositFlowErrorReason {
  switch (kind) {
    case 'wallet-rejected':
      return 'wallet-rejected'
    case 'chain-switch-failed':
      return 'chain-switch-failed'
    case 'transfer-failed':
      return 'transfer-failed'
    case 'wallet-unavailable':
    case 'balance-read-failed':
    case 'unknown':
      return 'unknown'
    default: {
      const exhaustive: never = kind
      return exhaustive
    }
  }
}

/**
 * Render an arbitrary thrown/mapped error `cause` into a single loggable string,
 * address-scrubbed at the boundary (logging.md rule 1/7). This is the field that
 * turns an opaque "Something went wrong" into a diagnosable line — it carries the
 * real RPC/network reason behind a `balance-read-failed` / `transfer-failed`.
 */
export function describeCause(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : String(cause)
  return scrubAddresses(raw)
}

/** Default interval injection shims (IN-DF-02); overridden in tests. */
export const globalSetInterval = (handler: () => void, ms: number): number =>
  window.setInterval(handler, ms)
export const globalClearInterval = (handle: number): void => window.clearInterval(handle)

/** Default per-attempt correlation-id minter (IN-DF-02); overridden in tests. */
export const defaultNewDepositId = (): string => crypto.randomUUID()

/**
 * The single recoverable-abort path (WR-DF-05): warn with the structured
 * fields, then dispatch `FAILED(reason)` so the machine lands on `error`. Lets
 * the preflight / switch / submit branches read as guard clauses against one
 * abort, instead of repeating `log.warn(...); dispatch(FAILED); return`.
 */
export function failWith(
  log: Logger,
  dispatch: (action: DepositFlowAction) => void,
  reason: DepositFlowErrorReason,
  fields: Record<string, unknown>,
  message: string,
): void {
  log.warn(fields, message)
  dispatch({ type: 'FAILED', reason })
}
