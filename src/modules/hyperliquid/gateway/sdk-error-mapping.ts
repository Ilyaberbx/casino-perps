import {
  ApiRequestError,
  HttpRequestError,
  HyperliquidError,
  ValidationError,
  WebSocketRequestError,
} from '@nktkas/hyperliquid'
import { UserRejectedRequestError } from 'viem'

/**
 * Runtime re-export of the SDK error class used by tests in the gateway zone
 * to construct synthetic SDK rejections without widening the SDK import
 * surface beyond the three D9 files.
 */
export { HttpRequestError } from '@nktkas/hyperliquid'
import { StatusCodes } from 'http-status-codes'
import { scrubAddresses } from '@/modules/shared/logger'
import { HyperliquidGatewayError } from './hyperliquid-gateway.types'

/**
 * Walk the `cause` chain of an error and collect all messages into a
 * scrubbed, human-readable suffix: " → <parent> → <child> → …".
 *
 * Why: the SDK's `AbstractWalletError` (extends `HyperliquidError`) wraps the
 * real signing failure as `cause`. Without walking the chain, the mapped
 * `errorMessage` only shows "Failed to sign typed data with viem wallet" and
 * the actual cause (e.g. a viem wallet rejection) is silently dropped.
 *
 * Security: every message in the chain is scrubbed via `scrubAddresses` before
 * being included. Private key material never appears in SDK error messages
 * (signing errors are about the signing call failing, not key bytes), but the
 * scrub ensures no accidental address leakage either.
 */
function buildCauseSuffix(err: unknown): string {
  const parts: string[] = []
  let current: unknown = err instanceof Error ? err.cause : undefined

  while (current !== undefined && current !== null) {
    const message = current instanceof Error ? current.message : String(current)
    parts.push(scrubAddresses(message))
    current = current instanceof Error ? current.cause : undefined
  }

  if (parts.length === 0) return ''
  return ` → ${parts.join(' → ')}`
}

/**
 * Translate any error thrown by @nktkas/hyperliquid (HTTP or WS) into our
 * gateway's typed `HyperliquidGatewayError` discriminated union.
 *
 * Why: callers (readers, stream) expect a typed Result, not an arbitrary throw.
 * The SDK's class hierarchy is the canonical surface for "what went wrong";
 * we keep our four-kind union as the boundary readers branch on. This is also
 * the boundary that scrubs raw wallet addresses out of SDK messages before
 * they reach `errorMessage` log fields.
 *
 * Cause chain: for `HyperliquidError` subclasses (including `AbstractWalletError`
 * which wraps viem/privy signing failures), the underlying cause chain is appended
 * to the message so the real failure reason is visible in logs. See defect diagnosis
 * in phase 01-03 continuation: without this, `approveAgent` failures surface only
 * "Failed to sign typed data with viem wallet", hiding the actual cause.
 */
/**
 * Walks the cause chain looking for a viem `UserRejectedRequestError`. Wallet
 * extensions wrap the rejection inside `AbstractWalletError` from the SDK and
 * occasionally inside one extra adapter layer; the marker is the viem class
 * itself rather than message-matching.
 */
function hasUserRejectionInChain(err: unknown): boolean {
  let current: unknown = err
  while (current !== undefined && current !== null) {
    if (current instanceof UserRejectedRequestError) return true
    current = current instanceof Error ? current.cause : undefined
  }
  return false
}

/**
 * Walks the cause chain collecting messages so the broad SDK errors can be
 * matched against substrings produced by deeper layers (`getChainId`,
 * `signTypedData`, or `ApiRequestError` payloads emitted by AbstractWalletError).
 */
function collectCauseMessages(err: unknown): string {
  const parts: string[] = []
  let current: unknown = err
  while (current !== undefined && current !== null) {
    if (current instanceof Error) parts.push(current.message)
    else parts.push(String(current))
    current = current instanceof Error ? current.cause : undefined
  }
  return parts.join(' ')
}

const CHAIN_MISMATCH_PATTERNS = [
  /chain (id )?mismatch/i,
  /wrong (chain|network)/i,
  /unsupported chain/i,
  /switch (chain|network)/i,
  /does not match/i,
]

const DEPOSIT_REQUIRED_PATTERNS = [/must deposit/i, /before performing actions/i]

const BUILDER_NOT_FUNDED_PATTERNS = [
  /builder fee( not)? (paid|funded)/i,
  /insufficient (balance|funds|usdc)/i,
]

const APPROVAL_CAP_PATTERNS = [
  /max approvals?/i,
  /approval (limit|cap)/i,
  /too many approvals/i,
]

const AGENT_CAP_PATTERNS = [
  /max agents?/i,
  /agent (limit|cap)/i,
  /too many.*agents/i,
]

const NAME_COLLISION_PATTERNS = [
  /duplicate agent name/i,
  /name exists/i,
  /name already/i,
  /already (exists|in use)/i,
]

// HL anti-replay (ADR-0077): re-approving a previously-used agent address is
// rejected with "Extra agent already used." Recoverable by minting a fresh key.
const AGENT_ADDRESS_REUSED_PATTERNS = [/extra agent already used/i]

function matchesAny(message: string, patterns: ReadonlyArray<RegExp>): boolean {
  return patterns.some((pattern) => pattern.test(message))
}

export function mapSdkError(cause: unknown): HyperliquidGatewayError {
  // Viem wallet rejection is the highest-confidence signal — check before everything else
  // so a UserRejectedRequestError nested under an AbstractWalletError doesn't fall through
  // to the generic HyperliquidError 'network' bucket.
  if (hasUserRejectionInChain(cause)) {
    const message = cause instanceof Error ? cause.message : String(cause)
    const causeChain = buildCauseSuffix(cause)
    return new HyperliquidGatewayError(
      'wallet-rejected',
      `Wallet rejected the request: ${scrubAddresses(message)}${causeChain}`,
      cause,
    )
  }

  if (cause instanceof ValidationError) {
    return new HyperliquidGatewayError(
      'invalid-response',
      `SDK validation failed: ${scrubAddresses(cause.message)}`,
      cause,
    )
  }
  if (cause instanceof ApiRequestError) {
    const body = cause.message
    const causeChain = buildCauseSuffix(cause)
    if (matchesAny(body, DEPOSIT_REQUIRED_PATTERNS)) {
      return new HyperliquidGatewayError(
        'deposit-required',
        `Deposit required: ${scrubAddresses(body)}${causeChain}`,
        cause,
      )
    }
    if (matchesAny(body, BUILDER_NOT_FUNDED_PATTERNS)) {
      return new HyperliquidGatewayError(
        'builder-not-funded',
        `Builder fee not funded: ${scrubAddresses(body)}${causeChain}`,
        cause,
      )
    }
    if (matchesAny(body, APPROVAL_CAP_PATTERNS)) {
      return new HyperliquidGatewayError(
        'approval-cap-reached',
        `Approval cap reached: ${scrubAddresses(body)}${causeChain}`,
        cause,
      )
    }
    if (matchesAny(body, AGENT_CAP_PATTERNS)) {
      return new HyperliquidGatewayError(
        'agent-cap-reached',
        `Agent cap reached: ${scrubAddresses(body)}${causeChain}`,
        cause,
      )
    }
    if (matchesAny(body, NAME_COLLISION_PATTERNS)) {
      return new HyperliquidGatewayError(
        'name-collision',
        `Agent name collision: ${scrubAddresses(body)}${causeChain}`,
        cause,
      )
    }
    if (matchesAny(body, AGENT_ADDRESS_REUSED_PATTERNS)) {
      return new HyperliquidGatewayError(
        'agent-address-reused',
        `Agent address already used: ${scrubAddresses(body)}${causeChain}`,
        cause,
      )
    }
    return new HyperliquidGatewayError(
      'network',
      `Hyperliquid API error: ${scrubAddresses(body)}${causeChain}`,
      cause,
    )
  }
  if (cause instanceof HttpRequestError) {
    const status = cause.response?.status
    if (status === StatusCodes.TOO_MANY_REQUESTS) {
      return new HyperliquidGatewayError('rate-limited', 'Hyperliquid rate-limited (HTTP 429)', cause)
    }
    const isUnknownUserStatus = status === StatusCodes.UNPROCESSABLE_ENTITY
    const looksLikeUnknownUser = /unknown user|does not exist/i.test(cause.message)
    if (isUnknownUserStatus || looksLikeUnknownUser) {
      return new HyperliquidGatewayError(
        'unknown-address',
        `Hyperliquid does not know this address: ${scrubAddresses(cause.message)}`,
        cause,
      )
    }
    return new HyperliquidGatewayError(
      'network',
      `Hyperliquid HTTP error: ${scrubAddresses(cause.message)}`,
      cause,
    )
  }
  if (cause instanceof WebSocketRequestError) {
    return new HyperliquidGatewayError(
      'network',
      `Hyperliquid WebSocket error: ${scrubAddresses(cause.message)}`,
      cause,
    )
  }
  if (cause instanceof HyperliquidError) {
    const fullChain = collectCauseMessages(cause)
    const isChainMismatch = matchesAny(fullChain, CHAIN_MISMATCH_PATTERNS)
    const causeChain = buildCauseSuffix(cause)
    if (isChainMismatch) {
      return new HyperliquidGatewayError(
        'chain-mismatch',
        `Wallet is on the wrong chain: ${scrubAddresses(cause.message)}${causeChain}`,
        cause,
      )
    }
    return new HyperliquidGatewayError(
      'network',
      `Hyperliquid SDK error: ${scrubAddresses(cause.message)}${causeChain}`,
      cause,
    )
  }
  const message = cause instanceof Error ? cause.message : String(cause)
  const fullChainMessage = collectCauseMessages(cause)
  const isChainMismatch = matchesAny(fullChainMessage, CHAIN_MISMATCH_PATTERNS)
  const causeChain = buildCauseSuffix(cause)
  if (isChainMismatch) {
    return new HyperliquidGatewayError(
      'chain-mismatch',
      `Wallet is on the wrong chain: ${scrubAddresses(message)}${causeChain}`,
      cause,
    )
  }
  return new HyperliquidGatewayError('network', `Unexpected SDK error: ${scrubAddresses(message)}${causeChain}`, cause)
}
