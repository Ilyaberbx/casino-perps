import { describe, it, expect } from 'vitest'
import type { AgentWalletAddress } from '../../agent-balance.types'
import { createAgentWithdrawAuthorizer, mapTransferError } from '../agent-withdraw-authorizer'
import {
  buildChainMismatchError,
  buildContractRevertedError,
  buildFakeReceiptClient,
  buildInsufficientFundsError,
  buildTimeoutReceiptClient,
  buildUserRejection,
  FAKE_SENT_HASH,
} from '../__fixtures__/fake-transfer-clients'
import { buildFakeWithdrawDeps } from '../__fixtures__/fake-withdraw-deps'

const DESTINATION =
  '0x3333333333333333333333333333333333333333' as AgentWalletAddress

describe('createAgentWithdrawAuthorizer', () => {
  it('requires a fresh explicit per-action authorization and sends USDC to the destination', async () => {
    const deps = buildFakeWithdrawDeps()
    const authorizer = createAgentWithdrawAuthorizer({
      requestExplicitAuthorization: deps.requestExplicitAuthorization,
      publicClient: buildFakeReceiptClient(),
    })

    const result = await authorizer.authorizeAndSend(DESTINATION, 7)

    expect(result.isOk()).toBe(true)
    // The explicit per-action prompt was requested exactly once for THIS send.
    expect(deps.spy.explicitAuthorizationCalls).toBe(1)
    // The USDC moved to the entered destination, scaled to 6-decimal units.
    expect(deps.transfers).toHaveLength(1)
    expect(deps.transfers[0].to).toBe(DESTINATION)
    expect(deps.transfers[0].amount).toBe(7_000000n)
  })

  it('invokes the EXPLICIT authorization path, never the standing delegated signer', async () => {
    const deps = buildFakeWithdrawDeps()
    const authorizer = createAgentWithdrawAuthorizer({
      // The delegated signer is deliberately wired as a poison pill: if the
      // authorizer ever falls back to it, the spy records a call and the
      // assertion below fails. ADR-0046 D-7: withdraw never uses the standing
      // delegation (Minara x402 + CCTP only).
      requestExplicitAuthorization: deps.requestExplicitAuthorization,
      publicClient: buildFakeReceiptClient(),
    })

    await authorizer.authorizeAndSend(DESTINATION, 7)

    expect(deps.spy.delegatedSignerCalls).toBe(0)
  })

  it('surfaces wallet-rejected when the user declines the explicit authorization', async () => {
    const deps = buildFakeWithdrawDeps({ noAuthorization: true })
    const authorizer = createAgentWithdrawAuthorizer({
      requestExplicitAuthorization: deps.requestExplicitAuthorization,
      publicClient: buildFakeReceiptClient(),
    })

    const result = await authorizer.authorizeAndSend(DESTINATION, 7)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('wallet-rejected')
    expect(deps.transfers).toHaveLength(0)
  })

  it('surfaces wallet-rejected when the user cancels the signature prompt', async () => {
    const deps = buildFakeWithdrawDeps({ rejectWith: buildUserRejection() })
    const authorizer = createAgentWithdrawAuthorizer({
      requestExplicitAuthorization: deps.requestExplicitAuthorization,
      publicClient: buildFakeReceiptClient(),
    })

    const result = await authorizer.authorizeAndSend(DESTINATION, 7)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('wallet-rejected')
  })

  it('surfaces transfer-failed on a non-rejection broadcast failure', async () => {
    const deps = buildFakeWithdrawDeps({ rejectWith: new Error('rpc down') })
    const authorizer = createAgentWithdrawAuthorizer({
      requestExplicitAuthorization: deps.requestExplicitAuthorization,
      publicClient: buildFakeReceiptClient(),
    })

    const result = await authorizer.authorizeAndSend(DESTINATION, 7)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('transfer-failed')
  })

  it('surfaces insufficient-gas when the broadcast rejects with InsufficientFundsError', async () => {
    const deps = buildFakeWithdrawDeps({ rejectWith: buildInsufficientFundsError() })
    const authorizer = createAgentWithdrawAuthorizer({
      requestExplicitAuthorization: deps.requestExplicitAuthorization,
      publicClient: buildFakeReceiptClient(),
    })

    const result = await authorizer.authorizeAndSend(DESTINATION, 7)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('insufficient-gas')
  })

  it('surfaces wrong-network when the broadcast rejects with ChainMismatchError', async () => {
    const deps = buildFakeWithdrawDeps({ rejectWith: buildChainMismatchError() })
    const authorizer = createAgentWithdrawAuthorizer({
      requestExplicitAuthorization: deps.requestExplicitAuthorization,
      publicClient: buildFakeReceiptClient(),
    })

    const result = await authorizer.authorizeAndSend(DESTINATION, 7)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('wrong-network')
  })

  it('surfaces insufficient-balance when the broadcast rejects with a ContractFunctionRevertedError', async () => {
    const deps = buildFakeWithdrawDeps({ rejectWith: buildContractRevertedError() })
    const authorizer = createAgentWithdrawAuthorizer({
      requestExplicitAuthorization: deps.requestExplicitAuthorization,
      publicClient: buildFakeReceiptClient(),
    })

    const result = await authorizer.authorizeAndSend(DESTINATION, 7)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('insufficient-balance')
  })

  it('surfaces insufficient-balance when the transaction mines but reverts on-chain', async () => {
    const deps = buildFakeWithdrawDeps()
    const authorizer = createAgentWithdrawAuthorizer({
      requestExplicitAuthorization: deps.requestExplicitAuthorization,
      publicClient: buildFakeReceiptClient({ status: 'reverted' }),
    })

    const result = await authorizer.authorizeAndSend(DESTINATION, 7)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('insufficient-balance')
    // The broadcast itself succeeded — only the mined status was reverted.
    expect(deps.transfers).toHaveLength(1)
  })

  it('surfaces receipt-timeout when waitForTransactionReceipt times out', async () => {
    const deps = buildFakeWithdrawDeps()
    const authorizer = createAgentWithdrawAuthorizer({
      requestExplicitAuthorization: deps.requestExplicitAuthorization,
      publicClient: buildTimeoutReceiptClient(FAKE_SENT_HASH),
    })

    const result = await authorizer.authorizeAndSend(DESTINATION, 7)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('receipt-timeout')
    // The broadcast itself succeeded — the timeout is about confirmation, not the send.
    expect(deps.transfers).toHaveLength(1)
  })
})

describe('mapTransferError', () => {
  it('scrubs a wallet address out of the classified error message', () => {
    const cause = new Error('failed for 0x1234567890123456789012345678901234567890')
    const error = mapTransferError(cause)
    expect(error.message).not.toContain('0x1234567890123456789012345678901234567890')
  })
})
