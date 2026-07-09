import { parseUnits } from 'viem'
import type { Balance, WalletAddress } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import { canonicalizeUnitToken } from '../../hyperliquid.utils'
import { HYPE_EVM_DECIMALS } from '../../services/hyperevm.constants'
import type { HyperEvmCoreErrorKind } from '../../services/hyperevm-core-service.types'
import type { SpotMetaResponse } from '../../gateway/sdk-types'
import type { HyperliquidGatewayErrorKind } from '../../gateway/hyperliquid-gateway.types'
import {
  failFlow,
  mapGatewayErrorToFlowError,
  percentOfAvailable as percentOfAvailableShared,
  resolveSelectedToken as resolveSelectedTokenShared,
  validateAmountInRange,
} from '../flow-machine/flow.utils'
import type { AmountValidation } from '../flow-machine/flow.utils'
import type {
  EvmCoreError,
  EvmCoreFlowAction,
  EvmCorePercent,
  EvmCoreToken,
} from './evm-core-flow-provider.types'
import {
  DEFAULT_EVM_CORE_DECIMALS,
  EVM_CORE_TOKEN_KEY_PREFIX,
  HYPE_SYSTEM_ADDRESS,
  HYPE_TOKEN_NAME,
  SYSTEM_ADDRESS_BASE,
} from './evm-core-flow.constants'

/**
 * A resolved EVM-linked token entry, built once from the spot meta and indexed
 * by canonical display symbol. Carries everything both directions need: the
 * `"NAME:0xTOKENID"` identifier (`spotSend`), the Core precision, the
 * system-address inputs (`index` / `isHype`), and the EVM-side fields the slice-2
 * EVM→Core path needs (`evmExtraWeiDecimals`, `evmAddress` — `null` for HYPE).
 */
export interface EvmCoreTokenInfo {
  readonly name: string
  readonly index: number
  readonly tokenId: string
  readonly decimals: number
  readonly isHype: boolean
  readonly evmExtraWeiDecimals: number
  readonly evmAddress: `0x${string}` | null
}

export type EvmCoreTokenIndex = ReadonlyMap<string, EvmCoreTokenInfo>

/**
 * The system address a standard token's funds are sent to (Core→EVM) — `0x20`
 * followed by 19 bytes with the token index big-endian in the low bytes:
 * `SYSTEM_ADDRESS_BASE + index`. Padded to a full 20-byte (40-hex) address.
 */
export function toSystemAddress(index: number): WalletAddress {
  const value = SYSTEM_ADDRESS_BASE + BigInt(index)
  const hex = value.toString(16).padStart(40, '0')
  return `0x${hex}` as WalletAddress
}

/**
 * The system address for a movable token. HYPE is special — it goes to the
 * literal `0x2222…2222`; every other token goes to its index-derived address.
 * ⚠ Never route a non-HYPE token to the HYPE address — it would be burned.
 */
export function systemAddressForToken(token: {
  readonly isHype: boolean
  readonly index: number
}): WalletAddress {
  if (token.isHype) return HYPE_SYSTEM_ADDRESS
  return toSystemAddress(token.index)
}

/**
 * Build a `displaySymbol → EvmCoreTokenInfo` index from the spot meta. A token is
 * **movable** iff it is EVM-linked (`evmContract !== null`) OR it is HYPE (the
 * native gas token, which has the special system address even when its
 * `evmContract` is absent). The map is keyed by the **canonicalized** display
 * symbol (UBTC → BTC) so it joins the balances reader's canonicalized rows; the
 * RAW `name` is kept for the `NAME:0xTOKENID` id + the system-address join.
 */
export function buildEvmCoreTokenIndex(meta: SpotMetaResponse): EvmCoreTokenIndex {
  const out = new Map<string, EvmCoreTokenInfo>()
  for (const token of meta.tokens) {
    const isHype = token.name === HYPE_TOKEN_NAME
    const evmContract = token.evmContract
    const isEvmLinked = evmContract !== null
    const isMovable = isEvmLinked || isHype
    if (!isMovable) continue
    const symbol = canonicalizeUnitToken(token.name)
    out.set(symbol, {
      name: token.name,
      index: token.index,
      tokenId: `${token.name}:${token.tokenId}`,
      decimals: token.weiDecimals ?? DEFAULT_EVM_CORE_DECIMALS,
      isHype,
      evmExtraWeiDecimals: evmContract?.evm_extra_wei_decimals ?? 0,
      evmAddress: evmContract?.address ?? null,
    })
  }
  return out
}

/**
 * The token's EVM-side decimals: HYPE is the native coin (18); every other token
 * is `weiDecimals + evm_extra_wei_decimals`. Used to read the EVM balance and to
 * scale the move amount into the token's smallest EVM unit.
 */
export function evmDecimalsForToken(token: {
  readonly isHype: boolean
  readonly decimals: number
  readonly evmExtraWeiDecimals: number
}): number {
  if (token.isHype) return HYPE_EVM_DECIMALS
  return token.decimals + token.evmExtraWeiDecimals
}

/**
 * Scale a human amount into the token's smallest EVM unit, **flooring** to EVM
 * precision first (sub-wei remainders are burned on HyperEVM, so never round up).
 * The validated amount already has ≤ `decimals` places, so the floor is a no-op on
 * the happy path; it defends against any drift.
 */
export function toEvmRawAmount(human: number, decimals: number): bigint {
  return parseUnits(floorToDecimals(human, decimals), decimals)
}

/** Floor a number to `decimals` fractional places, returned as a plain string. */
function floorToDecimals(value: number, decimals: number): string {
  const asString = value.toString()
  const dotIndex = asString.indexOf('.')
  if (dotIndex === -1) return asString
  if (decimals === 0) return asString.slice(0, dotIndex)
  return asString.slice(0, dotIndex + 1 + decimals)
}

/**
 * The EVM→Core token universe: ALL EVM-linked tokens from the spot meta index
 * (not filtered by HyperCore holdings — for EVM→Core the user moves what they hold
 * on HyperEVM, read live per selection). `available` starts at 0 and is filled by
 * the EVM balance read. Ordered by token name for a stable picker.
 */
export function buildEvmCoreTokensFromIndex(
  tokenIndex: EvmCoreTokenIndex,
): ReadonlyArray<EvmCoreToken> {
  const tokens: EvmCoreToken[] = []
  for (const [symbol, info] of tokenIndex) {
    tokens.push({
      key: `${EVM_CORE_TOKEN_KEY_PREFIX}${symbol}`,
      symbol,
      name: info.name,
      index: info.index,
      tokenId: info.tokenId,
      available: 0,
      decimals: info.decimals,
      isHype: info.isHype,
      evmExtraWeiDecimals: info.evmExtraWeiDecimals,
      evmAddress: info.evmAddress,
    })
  }
  return tokens.sort((a, b) => a.symbol.localeCompare(b.symbol))
}

/**
 * Compose the movable-token list from the HyperCore (L1 spot) balances. Every
 * held token with a positive balance whose canonical symbol resolves to an
 * EVM-linked token in the index is offered; a held token that is not EVM-linked
 * is EXCLUDED (never offer an unmovable token) and a `debug` line is logged so the
 * drop is diagnosable. Order follows balance order.
 */
export function buildEvmCoreTokens(
  coreBalances: ReadonlyArray<Balance>,
  tokenIndex: EvmCoreTokenIndex,
  log: Logger,
): ReadonlyArray<EvmCoreToken> {
  const tokens: EvmCoreToken[] = []
  for (const row of coreBalances) {
    const hasBalance = row.available > 0
    if (!hasBalance) continue
    const info = tokenIndex.get(row.asset)
    const isMovable = info !== undefined
    if (!isMovable) {
      log.debug({ symbol: row.asset }, 'evm-core token excluded — not EVM-linked')
      continue
    }
    tokens.push({
      key: `${EVM_CORE_TOKEN_KEY_PREFIX}${row.asset}`,
      symbol: row.asset,
      name: info.name,
      index: info.index,
      tokenId: info.tokenId,
      available: row.available,
      decimals: info.decimals,
      isHype: info.isHype,
      evmExtraWeiDecimals: info.evmExtraWeiDecimals,
      evmAddress: info.evmAddress,
    })
  }
  return tokens
}

/**
 * Resolve the selected token from the list by key, falling back to the first
 * token when the key has drifted (e.g. the selected token's balance dropped to
 * zero and it left the list). `null` only when the list is empty.
 */
export function resolveSelectedToken(
  tokens: ReadonlyArray<EvmCoreToken>,
  key: string,
): EvmCoreToken | null {
  return resolveSelectedTokenShared(tokens, key)
}

export type EvmCoreAmountValidation = AmountValidation

/**
 * Validate the entered `amount` against the selected token's `available` balance
 * and `decimals` cap. Valid when it parses to a finite number in
 * `(0, available]` with at most `decimals` fractional digits. Each failure gets a
 * plain reason string (text, not colour — a11y). On success returns the parsed
 * numeric `value` so the caller moves exactly what was validated.
 */
export function validateEvmCoreAmount(
  amount: string,
  available: number,
  decimals: number,
): EvmCoreAmountValidation {
  return validateAmountInRange(amount, available, decimals)
}

/**
 * The amount for a percentage of the available balance, clamped to the token's
 * `decimals` precision so the resulting string is always a valid amount. Returns
 * '' when nothing is available so the field clears rather than showing "0".
 */
export function percentOfAvailable(
  percent: EvmCorePercent,
  available: number,
  decimals: number,
): string {
  return percentOfAvailableShared(percent, available, decimals)
}

/**
 * Map a gateway error kind to the flow's typed `EvmCoreError`. Delegates to the
 * shared `mapGatewayErrorToFlowError`; the shared output union is a subset of
 * `EvmCoreError`, so the result is a valid `EvmCoreError`.
 */
export function mapGatewayErrorToEvmCoreError(kind: HyperliquidGatewayErrorKind): EvmCoreError {
  return mapGatewayErrorToFlowError(kind)
}

/**
 * Map a HyperEVM core-service error kind to the flow's typed `EvmCoreError`
 * (EVM→Core direction). Typed against `HyperEvmCoreErrorKind` so a new service
 * kind is a typecheck failure here rather than silent drift. The `never` arm
 * proves exhaustiveness.
 */
export function mapEvmServiceErrorToReason(kind: HyperEvmCoreErrorKind): EvmCoreError {
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
 * The single recoverable-abort path: warn with structured fields, then dispatch
 * `FAILED(reason)` so the machine lands on `error`. Lets the submit branch read
 * as guard clauses against one abort.
 */
export function failEvmCore(
  log: Logger,
  dispatch: (action: EvmCoreFlowAction) => void,
  reason: EvmCoreError,
  fields: Record<string, unknown>,
  message: string,
): void {
  failFlow<EvmCoreError, Extract<EvmCoreFlowAction, { type: 'FAILED' }>>(
    log,
    dispatch,
    reason,
    fields,
    message,
  )
}
