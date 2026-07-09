import { describe, expect, it } from 'vitest'
import type { WalletAddress } from '@/modules/shared/domain'
import {
  buildAgentSigningWallet,
  gatewayKindToAgentReason,
  isSameAgentAddress,
  resolveAgentDesync,
} from '../agent-wallet.utils'

// 0x + 64*'a' under viem's privateKeyToAccount derives this address (lowercased).
const VALID_KEY = ('0x' + 'a'.repeat(64)) as `0x${string}`
const VALID_KEY_AGENT_ADDRESS = '0x8fd379246834eac74b8419ffda202cf8051f7a03' as WalletAddress
const OTHER_AGENT_ADDRESS = '0xdeadbeefcafebabe0000000000000000deadbeef' as WalletAddress

describe('isSameAgentAddress', () => {
  it('compares case-insensitively', () => {
    expect(isSameAgentAddress('0xABC', '0xabc')).toBe(true)
    expect(isSameAgentAddress('0xABC', '0xdef')).toBe(false)
  })
})

// ADR-0036 D-2 taxonomy: approved | stale-own-agent | slots-full | missing.
const OWN_NAME = 'agent-f7a3'
const MAX_NAMED_AGENTS = 3

describe('resolveAgentDesync', () => {
  it('missing when HL has no agents (regardless of local key)', () => {
    expect(resolveAgentDesync(null, [], OWN_NAME, MAX_NAMED_AGENTS)).toEqual({ kind: 'missing' })
    expect(resolveAgentDesync(VALID_KEY, [], OWN_NAME, MAX_NAMED_AGENTS)).toEqual({
      kind: 'missing',
    })
  })

  it('missing when only foreign agents exist and a named slot is free (not a desync)', () => {
    expect(
      resolveAgentDesync(
        null,
        [{ address: OTHER_AGENT_ADDRESS, name: 'some-bot' }],
        OWN_NAME,
        MAX_NAMED_AGENTS,
      ),
    ).toEqual({ kind: 'missing' })
  })

  it('stale-own-agent when an agent carries our name but there is no local key', () => {
    expect(
      resolveAgentDesync(
        null,
        [{ address: OTHER_AGENT_ADDRESS, name: OWN_NAME }],
        OWN_NAME,
        MAX_NAMED_AGENTS,
      ),
    ).toEqual({ kind: 'stale-own-agent' })
  })

  it('stale-own-agent when our named agent exists but the local key derives another address', () => {
    expect(
      resolveAgentDesync(
        VALID_KEY,
        [{ address: OTHER_AGENT_ADDRESS, name: OWN_NAME }],
        OWN_NAME,
        MAX_NAMED_AGENTS,
      ),
    ).toEqual({ kind: 'stale-own-agent' })
  })

  it('slots-full when every named slot is foreign and the key matches none', () => {
    const foreignAgents = [
      { address: OTHER_AGENT_ADDRESS, name: 'bot-a' },
      { address: OTHER_AGENT_ADDRESS, name: 'bot-b' },
      { address: OTHER_AGENT_ADDRESS, name: 'bot-c' },
    ]
    expect(resolveAgentDesync(null, foreignAgents, OWN_NAME, MAX_NAMED_AGENTS)).toEqual({
      kind: 'slots-full',
    })
    expect(resolveAgentDesync(VALID_KEY, foreignAgents, OWN_NAME, MAX_NAMED_AGENTS)).toEqual({
      kind: 'slots-full',
    })
  })

  it('approved when the local key derives a matching HL agent address', () => {
    const result = resolveAgentDesync(
      VALID_KEY,
      [{ address: VALID_KEY_AGENT_ADDRESS, name: 'local' }],
      OWN_NAME,
      MAX_NAMED_AGENTS,
    )
    expect(result).toEqual({
      kind: 'approved',
      privateKey: VALID_KEY,
      address: VALID_KEY_AGENT_ADDRESS,
    })
  })

  it('approved wins over slots-full when the key matches one of a full roster', () => {
    const fullRoster = [
      { address: VALID_KEY_AGENT_ADDRESS, name: 'local' },
      { address: OTHER_AGENT_ADDRESS, name: 'bot-b' },
      { address: OTHER_AGENT_ADDRESS, name: 'bot-c' },
    ]
    const result = resolveAgentDesync(VALID_KEY, fullRoster, OWN_NAME, MAX_NAMED_AGENTS)
    expect(result.kind).toBe('approved')
  })

  it('matches case-insensitively against the HL agent address', () => {
    const upper = VALID_KEY_AGENT_ADDRESS.toUpperCase() as WalletAddress
    const result = resolveAgentDesync(
      VALID_KEY,
      [{ address: upper, name: 'local' }],
      OWN_NAME,
      MAX_NAMED_AGENTS,
    )
    expect(result.kind).toBe('approved')
  })
})

describe('gatewayKindToAgentReason', () => {
  it('maps the 1:1 kinds', () => {
    expect(gatewayKindToAgentReason('wallet-rejected')).toBe('wallet-rejected')
    expect(gatewayKindToAgentReason('chain-mismatch')).toBe('chain-mismatch')
    // ADR-0036: the reactive cap rejection converges on the picker reason.
    expect(gatewayKindToAgentReason('agent-cap-reached')).toBe('agent-slots-full')
    expect(gatewayKindToAgentReason('name-collision')).toBe('name-collision')
    expect(gatewayKindToAgentReason('rate-limited')).toBe('rate-limited')
    expect(gatewayKindToAgentReason('deposit-required')).toBe('deposit-required')
    // ADR-0077: HL anti-replay surfaces as its own self-healing reason, not 'unknown'.
    expect(gatewayKindToAgentReason('agent-address-reused')).toBe('agent-address-reused')
  })

  it('collapses kinds the agent step cannot semantically produce to unknown', () => {
    expect(gatewayKindToAgentReason('network')).toBe('unknown')
    expect(gatewayKindToAgentReason('invalid-response')).toBe('unknown')
    expect(gatewayKindToAgentReason('unknown-address')).toBe('unknown')
    expect(gatewayKindToAgentReason('builder-not-funded')).toBe('unknown')
    expect(gatewayKindToAgentReason('approval-cap-reached')).toBe('unknown')
  })
})

describe('buildAgentSigningWallet', () => {
  it('returns null for a null key (no approved agent / not loaded)', () => {
    expect(buildAgentSigningWallet(null)).toBeNull()
  })

  it('builds a viem signing account whose address derives from the key', () => {
    const wallet = buildAgentSigningWallet(VALID_KEY)
    expect(wallet).not.toBeNull()
    // The derived address is deterministic for the key and matches the known
    // agent address; this confirms the key was used without exposing it.
    const address = (wallet as { address: string }).address
    expect(address.toLowerCase()).toBe(VALID_KEY_AGENT_ADDRESS)
  })

  it('does not leak the private key on the returned signer', () => {
    const wallet = buildAgentSigningWallet(VALID_KEY)
    expect(JSON.stringify(wallet)).not.toContain(VALID_KEY)
  })
})
