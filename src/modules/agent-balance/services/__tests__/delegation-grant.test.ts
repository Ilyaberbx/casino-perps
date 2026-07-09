import { describe, it, expect } from 'vitest'
import { createDelegationGrant } from '../delegation-grant'
import { buildFakeApiClient, type ApiSpy } from '../__fixtures__/fake-delegation-api'
import type {
  AgentWalletAddress,
  AttachAgentSigner,
  DelegationScope,
  RemoveAgentSigner,
} from '../../agent-balance.types'

const AGENT_ID = 'minara'
const AGENT_WALLET = '0x4444444444444444444444444444444444444444' as AgentWalletAddress

const SCOPE: DelegationScope = {
  action: 'usdc-transfer-with-authorization',
  recipient: '0x5555555555555555555555555555555555555555' as AgentWalletAddress,
  capUsd: '50.00',
  expiresAt: '2026-07-12T00:00:00.000Z',
}

/** An attach seam that records its input and resolves a configurable consent. */
function recordingAttach(
  consent: boolean,
  sink: Parameters<AttachAgentSigner>[0][],
): AttachAgentSigner {
  return (input) => {
    sink.push(input)
    return Promise.resolve(consent)
  }
}

describe('createDelegationGrant — 3-step handshake (ADR-0078)', () => {
  it('prepares, attaches the app signer, then confirms with the policyId', async () => {
    const spy: ApiSpy = { posts: [], gets: [] }
    const attached: Parameters<AttachAgentSigner>[0][] = []
    const port = createDelegationGrant({
      client: buildFakeApiClient(
        { status: 'active', appSignerId: 'app-signer-9', policyId: 'policy-9' },
        spy,
      ),
      agentId: AGENT_ID,
      address: AGENT_WALLET,
      attachAgentSigner: recordingAttach(true, attached),
      removeAgentSigner: () => Promise.resolve(true),
    })

    const result = await port.grant(SCOPE)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toBe('active')
    // Prepare first, then confirm — both POSTs, in order.
    expect(spy.posts.map((p) => p.url)).toEqual([
      '/api/agent-treasury/delegation',
      '/api/agent-treasury/delegation/confirm',
    ])
    expect(spy.posts[0].body).toEqual({ agentId: AGENT_ID, ...SCOPE })
    // The app signer was attached with the prepared appSignerId + policyId.
    expect(attached).toEqual([
      { address: AGENT_WALLET, appSignerId: 'app-signer-9', policyId: 'policy-9' },
    ])
    // Confirm carries the prepared policyId alongside the scope.
    expect(spy.posts[1].body).toEqual({
      agentId: AGENT_ID,
      policyId: 'policy-9',
      ...SCOPE,
    })
  })

  it('surfaces signer-rejected and never confirms when the owner declines', async () => {
    const spy: ApiSpy = { posts: [], gets: [] }
    const port = createDelegationGrant({
      client: buildFakeApiClient({}, spy),
      agentId: AGENT_ID,
      address: AGENT_WALLET,
      attachAgentSigner: () => Promise.resolve(false),
      removeAgentSigner: () => Promise.resolve(true),
    })

    const result = await port.grant(SCOPE)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('signer-rejected')
    // Only the prepare POST ran — confirm never fired.
    expect(spy.posts.map((p) => p.url)).toEqual(['/api/agent-treasury/delegation'])
  })

  it('surfaces signer-failed when attaching the signer throws', async () => {
    const spy: ApiSpy = { posts: [], gets: [] }
    const port = createDelegationGrant({
      client: buildFakeApiClient({}, spy),
      agentId: AGENT_ID,
      address: AGENT_WALLET,
      attachAgentSigner: () => Promise.reject(new Error('sdk down')),
      removeAgentSigner: () => Promise.resolve(true),
    })

    const result = await port.grant(SCOPE)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('signer-failed')
    expect(spy.posts.map((p) => p.url)).toEqual(['/api/agent-treasury/delegation'])
  })

  it('revoke removes the app signer FIRST, then marks the server row revoked', async () => {
    const spy: ApiSpy = { posts: [], gets: [] }
    const removed: Parameters<RemoveAgentSigner>[0][] = []
    let postsAtRemoval = -1
    const removeAgentSigner: RemoveAgentSigner = (input) => {
      // At removal time the server revoke POST must NOT have fired yet.
      postsAtRemoval = spy.posts.length
      removed.push(input)
      return Promise.resolve(true)
    }
    const port = createDelegationGrant({
      client: buildFakeApiClient({ status: 'revoked', appSignerId: 'app-signer-7' }, spy),
      agentId: AGENT_ID,
      address: AGENT_WALLET,
      attachAgentSigner: () => Promise.resolve(true),
      removeAgentSigner,
    })

    const result = await port.revoke()

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toBe('revoked')
    // The standing status was read for the appSignerId.
    expect(spy.gets).toContain(
      `/api/agent-treasury/delegation?agentId=${AGENT_ID}`,
    )
    // Client signer removal ran BEFORE any server revoke POST, with the
    // appSignerId read from the standing status.
    expect(postsAtRemoval).toBe(0)
    expect(removed).toEqual([
      { address: AGENT_WALLET, appSignerId: 'app-signer-7' },
    ])
    expect(spy.posts.map((p) => p.url)).toEqual([
      '/api/agent-treasury/delegation/revoke',
    ])
    expect(spy.posts[0].body).toEqual({ agentId: AGENT_ID })
  })

  it('revoke proceeds to the server row-revoke when client removal best-effort-succeeds (signer already gone)', async () => {
    // The AuthBridge seam swallows a benign Privy `removeSigners` throw (e.g. the
    // signer is already detached) and resolves `true`, so the authoritative server
    // row-revoke still runs — this is what self-heals a stuck-Active delegation.
    const spy: ApiSpy = { posts: [], gets: [] }
    const port = createDelegationGrant({
      client: buildFakeApiClient({ status: 'revoked', appSignerId: 'app-signer-7' }, spy),
      agentId: AGENT_ID,
      address: AGENT_WALLET,
      attachAgentSigner: () => Promise.resolve(true),
      removeAgentSigner: () => Promise.resolve(true),
    })

    const result = await port.revoke()

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toBe('revoked')
    expect(spy.posts.map((p) => p.url)).toEqual([
      '/api/agent-treasury/delegation/revoke',
    ])
  })

  it('revoke aborts non-destructively (signer-rejected) when the owner declines removal', async () => {
    const spy: ApiSpy = { posts: [], gets: [] }
    const port = createDelegationGrant({
      client: buildFakeApiClient({ status: 'active', appSignerId: 'app-signer-7' }, spy),
      agentId: AGENT_ID,
      address: AGENT_WALLET,
      attachAgentSigner: () => Promise.resolve(true),
      removeAgentSigner: () => Promise.resolve(false),
    })

    const result = await port.revoke()

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('signer-rejected')
    // The owner declined the removal — the server row-revoke never fired.
    expect(spy.posts.map((p) => p.url)).toEqual([])
  })
})
