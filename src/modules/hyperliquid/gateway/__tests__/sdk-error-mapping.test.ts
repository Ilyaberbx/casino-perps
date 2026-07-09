import { describe, it, expect } from 'vitest'
import {
  ApiRequestError,
  HttpRequestError,
  HyperliquidError,
  ValidationError,
  WebSocketRequestError,
} from '@nktkas/hyperliquid'
import { UserRejectedRequestError } from 'viem'
import { mapSdkError } from '../sdk-error-mapping'

describe('mapSdkError', () => {
  it('maps a 429 HttpRequestError to rate-limited', () => {
    const response = new Response(null, { status: 429 })
    const cause = new HttpRequestError({ response, message: 'Too Many Requests' })
    const mapped = mapSdkError(cause)
    expect(mapped.kind).toBe('rate-limited')
    expect(mapped.cause).toBe(cause)
  })

  it('maps a 422 HttpRequestError to unknown-address', () => {
    const response = new Response(null, { status: 422 })
    const cause = new HttpRequestError({ response, message: 'unknown user 0xabc' })
    const mapped = mapSdkError(cause)
    expect(mapped.kind).toBe('unknown-address')
  })

  it('maps a generic 500 HttpRequestError to network', () => {
    const response = new Response(null, { status: 500 })
    const cause = new HttpRequestError({ response, message: 'Internal Server Error' })
    expect(mapSdkError(cause).kind).toBe('network')
  })

  it('maps a WebSocketRequestError to network', () => {
    const cause = new WebSocketRequestError('WebSocket connection closed')
    expect(mapSdkError(cause).kind).toBe('network')
  })

  it('maps a ValidationError to invalid-response', () => {
    // ValiError is structural; cast through unknown to satisfy the SDK's typed cause.
    const cause = new ValidationError('bad shape', { cause: { issues: [] } as never })
    expect(mapSdkError(cause).kind).toBe('invalid-response')
  })

  it('maps an unknown HyperliquidError subclass to network', () => {
    const cause = new HyperliquidError('something else')
    expect(mapSdkError(cause).kind).toBe('network')
  })

  it('maps a non-HyperliquidError throwable to network', () => {
    const cause = new TypeError('boom')
    expect(mapSdkError(cause).kind).toBe('network')
  })

  it('scrubs a full raw wallet address out of an unknown-address message', () => {
    const rawAddress = '0x1234567890abcdef1234567890abcdef12345678'
    const response = new Response(null, { status: 422 })
    const cause = new HttpRequestError({
      response,
      message: `unknown user ${rawAddress}`,
    })
    const mapped = mapSdkError(cause)
    expect(mapped.kind).toBe('unknown-address')
    expect(mapped.message).not.toContain(rawAddress)
    expect(mapped.message).toContain('0x…5678')
  })

  it('scrubs raw wallet addresses out of generic network error messages', () => {
    const rawAddress = '0xABCDEF0123456789ABCDEF0123456789ABCDEF01'
    const response = new Response(null, { status: 500 })
    const cause = new HttpRequestError({
      response,
      message: `server failed for ${rawAddress}`,
    })
    const mapped = mapSdkError(cause)
    expect(mapped.kind).toBe('network')
    expect(mapped.message).not.toContain(rawAddress)
    expect(mapped.message).not.toMatch(/0x[0-9a-fA-F]{40}/)
    expect(mapped.message).toContain('0x…ef01')
  })

  it('surfaces underlying cause chain for a wrapped HyperliquidError (regression: AbstractWalletError)', () => {
    // Simulates: AbstractWalletError wraps a viem wallet signing failure.
    // Before the fix, mapSdkError only showed "Failed to sign typed data with viem wallet"
    // and the real cause was silently dropped — making the errorMessage log field blind.
    const realCause = new Error('User rejected the request')
    const wrappedError = new HyperliquidError('Failed to sign typed data with viem wallet', {
      cause: realCause,
    })
    const mapped = mapSdkError(wrappedError)
    expect(mapped.kind).toBe('network')
    expect(mapped.message).toContain('Failed to sign typed data with viem wallet')
    expect(mapped.message).toContain('User rejected the request')
  })

  it('surfaces a multi-level cause chain for a HyperliquidError', () => {
    const deepCause = new Error('Network timeout')
    const midCause = new Error('Connection refused', { cause: deepCause })
    const topError = new HyperliquidError('SDK request failed', { cause: midCause })
    const mapped = mapSdkError(topError)
    expect(mapped.message).toContain('SDK request failed')
    expect(mapped.message).toContain('Connection refused')
    expect(mapped.message).toContain('Network timeout')
  })

  it('surfaces underlying cause chain for an unknown non-SDK error wrapping another error', () => {
    const innerCause = new Error('underlying failure')
    const outerError = new TypeError('outer wrapper', { cause: innerCause })
    const mapped = mapSdkError(outerError)
    expect(mapped.kind).toBe('network')
    expect(mapped.message).toContain('outer wrapper')
    expect(mapped.message).toContain('underlying failure')
  })

  it('does not append a cause suffix when there is no cause', () => {
    const cause = new HyperliquidError('simple error with no cause')
    const mapped = mapSdkError(cause)
    expect(mapped.message).toBe('Hyperliquid SDK error: simple error with no cause')
  })

  // -------------------------------------------------------------------------
  // Slice 6 (#166) — widened error taxonomy
  // -------------------------------------------------------------------------

  it('maps viem UserRejectedRequestError to wallet-rejected', () => {
    const cause = new UserRejectedRequestError(new Error('user rejected') as Error)
    const mapped = mapSdkError(cause)
    expect(mapped.kind).toBe('wallet-rejected')
  })

  it('maps a UserRejectedRequestError nested inside a HyperliquidError to wallet-rejected', () => {
    const inner = new UserRejectedRequestError(new Error('user rejected') as Error)
    const wrapper = new HyperliquidError('Failed to sign typed data with viem wallet', {
      cause: inner,
    })
    const mapped = mapSdkError(wrapper)
    expect(mapped.kind).toBe('wallet-rejected')
  })

  it('maps a HyperliquidError with chain-mismatch in the cause chain to chain-mismatch', () => {
    const inner = new Error('chain mismatch: expected 42161')
    const wrapper = new HyperliquidError('Failed to sign typed data with viem wallet', {
      cause: inner,
    })
    const mapped = mapSdkError(wrapper)
    expect(mapped.kind).toBe('chain-mismatch')
  })

  it('maps an ApiRequestError with "builder fee paid" body to builder-not-funded', () => {
    const cause = new ApiRequestError({
      status: 'err',
      response: 'builder fee not paid',
    })
    const mapped = mapSdkError(cause)
    expect(mapped.kind).toBe('builder-not-funded')
  })

  it('maps an ApiRequestError with "insufficient" body to builder-not-funded', () => {
    const cause = new ApiRequestError({
      status: 'err',
      response: 'insufficient USDC balance',
    })
    const mapped = mapSdkError(cause)
    expect(mapped.kind).toBe('builder-not-funded')
  })

  it('maps an ApiRequestError with "max approvals" body to approval-cap-reached', () => {
    const cause = new ApiRequestError({
      status: 'err',
      response: 'max approvals exceeded',
    })
    const mapped = mapSdkError(cause)
    expect(mapped.kind).toBe('approval-cap-reached')
  })

  it('maps an ApiRequestError with "approval limit" body to approval-cap-reached', () => {
    const cause = new ApiRequestError({
      status: 'err',
      response: 'approval limit reached',
    })
    const mapped = mapSdkError(cause)
    expect(mapped.kind).toBe('approval-cap-reached')
  })

  it('maps an ApiRequestError with "max agents" body to agent-cap-reached', () => {
    const cause = new ApiRequestError({
      status: 'err',
      response: 'max agents reached',
    })
    const mapped = mapSdkError(cause)
    expect(mapped.kind).toBe('agent-cap-reached')
  })

  it('maps an ApiRequestError with "agent limit" body to agent-cap-reached', () => {
    const cause = new ApiRequestError({
      status: 'err',
      response: 'agent limit exceeded for user',
    })
    const mapped = mapSdkError(cause)
    expect(mapped.kind).toBe('agent-cap-reached')
  })

  it('maps an ApiRequestError with "too many extra agents" body to agent-cap-reached', () => {
    const cause = new ApiRequestError({
      status: 'err',
      response: 'Too many extra agents for cumulative volume traded. Current limit is 3',
    })
    const mapped = mapSdkError(cause)
    expect(mapped.kind).toBe('agent-cap-reached')
  })

  it('maps an ApiRequestError with "duplicate agent name" body to name-collision', () => {
    const cause = new ApiRequestError({
      status: 'err',
      response: 'duplicate agent name foo',
    })
    const mapped = mapSdkError(cause)
    expect(mapped.kind).toBe('name-collision')
  })

  it('maps an ApiRequestError with "name exists" body to name-collision', () => {
    const cause = new ApiRequestError({
      status: 'err',
      response: 'agent name already in use',
    })
    const mapped = mapSdkError(cause)
    expect(mapped.kind).toBe('name-collision')
  })

  it('maps an ApiRequestError with "Extra agent already used" body to agent-address-reused (ADR-0077)', () => {
    const cause = new ApiRequestError({
      status: 'err',
      response: 'Extra agent already used.',
    })
    const mapped = mapSdkError(cause)
    expect(mapped.kind).toBe('agent-address-reused')
  })

  it('preserves cause chain through wallet-rejected mapping', () => {
    const inner = new UserRejectedRequestError(new Error('user rejected') as Error)
    const wrapper = new HyperliquidError('Failed to sign typed data with viem wallet', {
      cause: inner,
    })
    const mapped = mapSdkError(wrapper)
    expect(mapped.kind).toBe('wallet-rejected')
    expect(mapped.message).toContain('Failed to sign typed data with viem wallet')
  })

  it('scrubs addresses in cause chain messages (AGENT-05 boundary)', () => {
    const rawAddress = '0x1234567890abcdef1234567890abcdef12345678'
    const innerCause = new Error(`rejected by ${rawAddress}`)
    const outerError = new HyperliquidError('Failed to sign typed data with viem wallet', {
      cause: innerCause,
    })
    const mapped = mapSdkError(outerError)
    expect(mapped.message).not.toContain(rawAddress)
    expect(mapped.message).not.toMatch(/0x[0-9a-fA-F]{40}/)
  })

  // -------------------------------------------------------------------------
  // Phase 07 Plan 01 — deposit-required classification (DEP-01)
  // -------------------------------------------------------------------------

  it('maps an ApiRequestError with "must deposit" body to deposit-required', () => {
    const cause = new ApiRequestError({
      status: 'err',
      response: 'must deposit before performing actions',
    })
    const mapped = mapSdkError(cause)
    expect(mapped.kind).toBe('deposit-required')
  })

  it('maps an ApiRequestError with "before performing actions" body to deposit-required', () => {
    const cause = new ApiRequestError({
      status: 'err',
      response: 'before performing actions you must fund your account',
    })
    const mapped = mapSdkError(cause)
    expect(mapped.kind).toBe('deposit-required')
  })

  it('regression: "insufficient USDC balance" still maps to builder-not-funded (not deposit-required)', () => {
    const cause = new ApiRequestError({
      status: 'err',
      response: 'insufficient USDC balance',
    })
    const mapped = mapSdkError(cause)
    expect(mapped.kind).toBe('builder-not-funded')
  })

  it('regression: "builder fee paid" still maps to builder-not-funded (not deposit-required)', () => {
    const cause = new ApiRequestError({
      status: 'err',
      response: 'builder fee not paid',
    })
    const mapped = mapSdkError(cause)
    expect(mapped.kind).toBe('builder-not-funded')
  })

  it('scrubs raw 0x address from deposit-required body', () => {
    const rawAddress = '0xabc1234567890abcdef1234567890abcdef003866'
    const cause = new ApiRequestError({
      status: 'err',
      response: `Must deposit before performing actions. User: ${rawAddress}`,
    })
    const mapped = mapSdkError(cause)
    expect(mapped.kind).toBe('deposit-required')
    expect(mapped.message).not.toMatch(/0x[0-9a-fA-F]{40}/)
  })
})
