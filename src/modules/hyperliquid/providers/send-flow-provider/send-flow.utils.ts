import { parseWalletAddress } from '@/modules/shared/domain'
import type { Balance, WalletAddress } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import { USDC_SYMBOL } from '../../hyperliquid.constants'
import { canonicalizeUnitToken } from '../../hyperliquid.utils'
import type { SpotMetaResponse } from '../../gateway/sdk-types'
import type { HyperliquidGatewayErrorKind } from '../../gateway/hyperliquid-gateway.types'
import {
  failFlow,
  mapGatewayErrorToFlowError,
  percentOfAvailable as percentOfAvailableShared,
  readUsdcAvailable as readUsdcAvailableShared,
  resolveSelectedToken as resolveSelectedTokenShared,
  validateAmountInRange,
} from '../flow-machine/flow.utils'
import type { AmountValidation } from '../flow-machine/flow.utils'
import type {
  SendableToken,
  SendError,
  SendFlowAction,
  SendPercent,
} from './send-flow-provider.types'
import {
  DEFAULT_SPOT_SEND_DECIMALS,
  SPOT_TOKEN_KEY_PREFIX,
  USDC_SEND_DECIMALS,
  USD_TOKEN_KEY,
} from './send-flow.constants'

/**
 * A resolved spot-token entry: the canonical display symbol (the join key for a
 * balance row), the `"NAME:0xTOKENID"` identifier `spotSend` wants, and the
 * token's max precision. Built once from the spot meta and indexed by symbol.
 */
export interface SpotSendTokenInfo {
  readonly tokenId: string
  readonly decimals: number
}

export type SpotSendTokenIndex = ReadonlyMap<string, SpotSendTokenInfo>

/**
 * Build a `displaySymbol → { tokenId, decimals }` index from the spot meta. The
 * `spotSend` token identifier is `"NAME:0xTOKENID"` where `NAME` is the RAW HL
 * token name and `0xTOKENID` is `token.tokenId`. The map is keyed by the
 * **canonicalized** display symbol (UBTC → BTC) so it joins the balances reader's
 * canonicalized `asset` rows. USDC IS indexed here (its `"USDC:0x…"` id is needed
 * for the UNIFIED-account `spotSend` route); the account mode — not this index —
 * decides USDC's send route in `buildSendableTokens`, and the spot-balance loop
 * there still skips USDC so no duplicate row appears.
 */
export function buildSpotSendTokenIndex(meta: SpotMetaResponse): SpotSendTokenIndex {
  const out = new Map<string, SpotSendTokenInfo>()
  for (const token of meta.tokens) {
    const symbol = canonicalizeUnitToken(token.name)
    const tokenId = `${token.name}:${token.tokenId}`
    const decimals = token.weiDecimals ?? DEFAULT_SPOT_SEND_DECIMALS
    out.set(symbol, { tokenId, decimals })
  }
  return out
}

/** Read the USDC row's available balance from a balances projection, or 0. */
export const readUsdcAvailable = readUsdcAvailableShared

/**
 * The account-mode-aware USDC sendable token, or `null` when USDC can't be sent.
 *
 * USDC lives in a different sub-account depending on the account mode
 * (hyperliquid-account-modes.md §0/§3), and the two sub-accounts are moved by two
 * different HL actions:
 * - **segregated** (classic) → perp USDC, routed via `usdSend`. The cap is the
 *   perp `available` (the `'perps'`-scope `withdrawable`). Always sendable.
 * - **unified / portfolio margin** → the pooled collateral lives in the SPOT
 *   clearinghouse (the `'all'`-scope `source:'unified'` USDC row), so it must be
 *   routed via `spotSend` with USDC's `"USDC:0x…"` id — `usdSend` would target the
 *   phantom-0 perp side and be rejected. Returns `null` (USDC omitted, `debug`
 *   logged) if the id can't be resolved yet (meta still loading) — never offer an
 *   unsendable token; `assetsStatus` covers the brief loading window.
 *
 * The picker key stays `USD_TOKEN_KEY` in both modes so a persisted selection
 * survives a mode flip; only the route (`kind`) + cap change.
 */
function buildUsdcSendableToken(
  isSegregated: boolean,
  perpUsdcAvailable: number,
  allBalances: ReadonlyArray<Balance>,
  tokenIndex: SpotSendTokenIndex,
  log: Logger,
): SendableToken | null {
  if (isSegregated) {
    return {
      key: USD_TOKEN_KEY,
      kind: 'usd',
      symbol: USDC_SYMBOL,
      available: perpUsdcAvailable,
      decimals: USDC_SEND_DECIMALS,
    }
  }
  const info = tokenIndex.get(USDC_SYMBOL)
  const isResolvable = info !== undefined
  if (!isResolvable) {
    log.debug({ symbol: USDC_SYMBOL }, 'unified USDC excluded — unresolved id')
    return null
  }
  return {
    key: USD_TOKEN_KEY,
    kind: 'spot',
    symbol: USDC_SYMBOL,
    available: readUsdcAvailable(allBalances),
    decimals: USDC_SEND_DECIMALS,
    tokenId: info.tokenId,
  }
}

/**
 * Compose the sendable-token list. USDC is offered first, account-mode-aware (see
 * `buildUsdcSendableToken`): `usdSend`/perp for a segregated account, `spotSend`
 * of the unified spot USDC for a unified account. Every held spot token with a
 * positive balance routes via `spotSend` if — and only if — its `"NAME:0xTOKENID"`
 * resolves from the spot meta index. A spot token whose id cannot be resolved is
 * EXCLUDED (never offer an unsendable token) and a `debug` line is logged so the
 * drop is diagnosable. Spot tokens follow USDC in balance order.
 */
export function buildSendableTokens(
  isSegregated: boolean,
  perpUsdcAvailable: number,
  allBalances: ReadonlyArray<Balance>,
  tokenIndex: SpotSendTokenIndex,
  log: Logger,
): ReadonlyArray<SendableToken> {
  const tokens: SendableToken[] = []
  const usdcToken = buildUsdcSendableToken(
    isSegregated,
    perpUsdcAvailable,
    allBalances,
    tokenIndex,
    log,
  )
  if (usdcToken !== null) tokens.push(usdcToken)

  for (const row of allBalances) {
    const isUsdc = row.asset === USDC_SYMBOL
    if (isUsdc) continue
    const hasBalance = row.available > 0
    if (!hasBalance) continue
    const info = tokenIndex.get(row.asset)
    const isResolvable = info !== undefined
    if (!isResolvable) {
      log.debug({ symbol: row.asset }, 'send token excluded — unresolved id')
      continue
    }
    tokens.push({
      key: `${SPOT_TOKEN_KEY_PREFIX}${row.asset}`,
      kind: 'spot',
      symbol: row.asset,
      available: row.available,
      decimals: info.decimals,
      tokenId: info.tokenId,
    })
  }
  return tokens
}

/**
 * Resolve the selected token from the list by key, falling back to the first
 * token when the key has drifted (e.g. the selected spot token's balance dropped
 * to zero and it left the list). `null` only when the list is empty.
 */
export function resolveSelectedToken(
  tokens: ReadonlyArray<SendableToken>,
  key: string,
): SendableToken | null {
  return resolveSelectedTokenShared(tokens, key)
}

export type SendAmountValidation = AmountValidation

/**
 * Validate the entered `amount` against the selected token's `available` balance
 * and `decimals` cap. Valid when it parses to a finite number in
 * `(0, available]` with at most `decimals` fractional digits. Empty /
 * unparseable / non-positive / over-balance / over-precision each get a plain
 * reason string (text, not colour — a11y). On success returns the parsed numeric
 * `value` so the caller sends exactly what was validated.
 */
export function validateSendAmount(
  amount: string,
  available: number,
  decimals: number,
): SendAmountValidation {
  return validateAmountInRange(amount, available, decimals)
}

export type SendDestinationValidation =
  | { readonly isValid: false; readonly reason: SendError }
  | { readonly isValid: true; readonly reason: null }

/**
 * Validate the recipient `destination`. Valid when it parses to a well-formed
 * `0x` address AND is not equal to the user's own master address (sending to
 * yourself is a likely mistake — surface a clear reason). The own-address compare
 * is case-insensitive (addresses are equal regardless of checksum casing).
 */
export function validateSendDestination(
  destination: string,
  ownAddress: WalletAddress | null,
): SendDestinationValidation {
  const trimmed = destination.trim()
  const parsed = parseWalletAddress(trimmed)
  if (parsed.isErr()) return { isValid: false, reason: 'destination-invalid' }

  const isOwnAddress =
    ownAddress !== null && trimmed.toLowerCase() === ownAddress.toLowerCase()
  if (isOwnAddress) return { isValid: false, reason: 'self-send' }

  return { isValid: true, reason: null }
}

/**
 * The amount for a percentage of the available balance, clamped to the token's
 * `decimals` precision so the resulting string is always a valid amount. Returns
 * '' when nothing is available so the field clears rather than showing "0".
 */
export function percentOfAvailable(
  percent: SendPercent,
  available: number,
  decimals: number,
): string {
  return percentOfAvailableShared(percent, available, decimals)
}

/**
 * Map a gateway error kind to the flow's typed `SendError`. Delegates to the
 * shared `mapGatewayErrorToFlowError`; the shared output union is a subset of
 * `SendError`, so the result is a valid `SendError`.
 */
export function mapGatewayErrorToSendError(kind: HyperliquidGatewayErrorKind): SendError {
  return mapGatewayErrorToFlowError(kind)
}

/**
 * The single recoverable-abort path: warn with structured fields, then dispatch
 * `FAILED(reason)` so the machine lands on `error`. Lets the submit branch read
 * as guard clauses against one abort.
 */
export function failSend(
  log: Logger,
  dispatch: (action: SendFlowAction) => void,
  reason: SendError,
  fields: Record<string, unknown>,
  message: string,
): void {
  failFlow<SendError, Extract<SendFlowAction, { type: 'FAILED' }>>(
    log,
    dispatch,
    reason,
    fields,
    message,
  )
}
