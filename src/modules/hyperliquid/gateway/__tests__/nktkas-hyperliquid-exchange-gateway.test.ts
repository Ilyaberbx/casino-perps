import { describe, it, expect } from 'vitest'
import type { WalletClient } from 'viem'
import type { WalletAddress } from '@/modules/shared/domain'
import { createNktkasHyperliquidExchangeGateway } from '../nktkas-hyperliquid-exchange-gateway'
import { HttpRequestError } from '../sdk-error-mapping'
import type { IRequestTransport } from '../sdk-types'
import { buildFakeLogger } from '../../services/__fixtures__/web-data2'

const AGENT_ADDRESS = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress
const AGENT_NAME = 'test-agent'

function fakeRequestTransport(
  impl: (payload: unknown) => Promise<unknown>,
  isTestnet = true,
): IRequestTransport {
  return {
    isTestnet,
    request: <T>(_endpoint: 'info' | 'exchange' | 'explorer', payload: unknown): Promise<T> =>
      impl(payload) as Promise<T>,
  }
}

/**
 * A minimal fake that satisfies the SDK's AbstractViemJsonRpcAccount shape
 * (signTypedData with arity 1|2, getAddresses, getChainId). The gateway
 * accepts WalletClient for approveAgent; in tests we cast through `as never`
 * because constructing a real viem WalletClient from a fake EIP-1193 provider
 * adds complexity with no test value.
 *
 * signTypedData.length must be 1 or 2 for the SDK's isViemJsonRpcAccount guard.
 * Signature: 65 bytes (132 hex chars), last byte 0x1b = v=27 (valid recovery value).
 */
type FakeViemWalletClient = Pick<WalletClient, 'signTypedData' | 'getAddresses' | 'getChainId'> & { address: `0x${string}` }

async function fakeSignTypedData(params: unknown): Promise<`0x${string}`> {
  void params
  return `0x${'a'.repeat(128)}1b` as `0x${string}`
}

async function brokenSignTypedData(params: unknown): Promise<`0x${string}`> {
  void params
  throw new Error('signing failed')
}

function makeFakeWalletClient(): FakeViemWalletClient {
  return {
    signTypedData: fakeSignTypedData as FakeViemWalletClient['signTypedData'],
    getAddresses: async () => ['0xabcdef0123456789abcdef0123456789abcdef01' as `0x${string}`],
    getChainId: async () => 8453,
    address: '0xabcdef0123456789abcdef0123456789abcdef01' as `0x${string}`,
  }
}

describe('createNktkasHyperliquidExchangeGateway', () => {
  describe('approveAgent', () => {
    it('returns okAsync(undefined) on success', async () => {
      // SDK expects { status: 'ok', response: { type: 'default' } } for approveAgent success
      const httpTransport = fakeRequestTransport(async () => ({
        status: 'ok',
        response: { type: 'default' },
      }))
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      // Cast: FakeViemWalletClient satisfies AbstractViemJsonRpcAccount at runtime but is
      // not structurally a full WalletClient. The cast is safe in tests — the gateway only
      // uses getChainId/getAddresses/signTypedData from the wallet, all of which are stubbed.
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      const result = await gateway.approveAgent(masterWallet, AGENT_ADDRESS, AGENT_NAME)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toBeUndefined()
    })

    it('returns errAsync(HyperliquidGatewayError) when SDK throws', async () => {
      const httpTransport = fakeRequestTransport(() =>
        Promise.reject(
          new HttpRequestError({
            response: new Response(null, { status: 500 }),
            message: 'server error',
          }),
        ),
      )
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      const result = await gateway.approveAgent(masterWallet, AGENT_ADDRESS, AGENT_NAME)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.kind).toBe('network')
      }
    })

    it('does not log any field matching the private key shape (AGENT-05)', async () => {
      const { logger, records } = buildFakeLogger()
      const httpTransport = fakeRequestTransport(async () => ({
        status: 'ok',
        response: { type: 'default' },
      }))
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      await gateway.approveAgent(masterWallet, AGENT_ADDRESS, AGENT_NAME)

      const privateKeyPattern = /^0x[0-9a-f]{64}$/
      for (const record of records) {
        for (const value of Object.values(record.fields)) {
          expect(typeof value === 'string' && privateKeyPattern.test(value)).toBe(false)
        }
      }
    })
  })

  describe('approveBuilderFee', () => {
    const USER_ADDRESS = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress

    it('returns okAsync(undefined) on success', async () => {
      const httpTransport = fakeRequestTransport(async () => ({
        status: 'ok',
        response: { type: 'default' },
      }))
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      const result = await gateway.approveBuilderFee(masterWallet)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toBeUndefined()
    })

    it('sends maxFeeRate and builder address from HYPERLIQUID_BUILDER on testnet', async () => {
      const seen: Array<Record<string, unknown>> = []
      const httpTransport = fakeRequestTransport(async (payload) => {
        seen.push(payload as Record<string, unknown>)
        return { status: 'ok', response: { type: 'default' } }
      })
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      const result = await gateway.approveBuilderFee(masterWallet)
      expect(result.isOk()).toBe(true)
      expect(seen.length).toBe(1)
      const action = (seen[0] as { action: Record<string, unknown> }).action
      expect(action.type).toBe('approveBuilderFee')
      // 35 tenths of bps = 3.5 bps = 0.035% (integer tenths-of-bps, so HL
      // accepts it). The pre-fix "0.0035%" was sub-resolution and rejected
      // as "Percentage is invalid" — ADR-0024 Amendment (2026-05-30).
      expect(action.maxFeeRate).toBe('0.035%')
      expect(String(action.builder).toLowerCase()).toBe(
        '0xff9be883a670afe4c1e8dcb2fc05afb2caecd6b7',
      )
      expect(action.hyperliquidChain).toBe('Testnet')
    })

    it('uses hyperliquidChain "Mainnet" when isTestnet=false', async () => {
      const seen: Array<Record<string, unknown>> = []
      const httpTransport = fakeRequestTransport(async (payload) => {
        seen.push(payload as Record<string, unknown>)
        return { status: 'ok', response: { type: 'default' } }
      }, false)
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: false,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      await gateway.approveBuilderFee(masterWallet)
      const action = (seen[0] as { action: Record<string, unknown> }).action
      expect(action.hyperliquidChain).toBe('Mainnet')
    })

    it('returns errAsync(HyperliquidGatewayError) when SDK throws', async () => {
      const httpTransport = fakeRequestTransport(() =>
        Promise.reject(
          new HttpRequestError({
            response: new Response(null, { status: 500 }),
            message: 'server error',
          }),
        ),
      )
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      const result = await gateway.approveBuilderFee(masterWallet)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('network')
    })

    it('does not log the builder address as a raw field (AGENT-05 / logging redaction)', async () => {
      const { logger, records } = buildFakeLogger()
      const httpTransport = fakeRequestTransport(async () => ({
        status: 'ok',
        response: { type: 'default' },
      }))
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      await gateway.approveBuilderFee(masterWallet)
      for (const record of records) {
        for (const value of Object.values(record.fields)) {
          const isStringValue = typeof value === 'string'
          const looksLikeAddress = isStringValue && /^0x[0-9a-f]{40}$/i.test(value as string)
          expect(looksLikeAddress).toBe(false)
        }
      }
      void USER_ADDRESS
    })
  })

  describe('enableDexAbstraction', () => {
    const USER_ADDRESS = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress

    it('returns okAsync(undefined) on success', async () => {
      const httpTransport = fakeRequestTransport(async () => ({
        status: 'ok',
        response: { type: 'default' },
      }))
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      const result = await gateway.enableDexAbstraction(masterWallet, USER_ADDRESS)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toBeUndefined()
    })

    it('signs and POSTs a userDexAbstraction action carrying user + enabled:true', async () => {
      const seen: Array<Record<string, unknown>> = []
      const httpTransport = fakeRequestTransport(async (payload) => {
        seen.push(payload as Record<string, unknown>)
        return { status: 'ok', response: { type: 'default' } }
      })
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      const result = await gateway.enableDexAbstraction(masterWallet, USER_ADDRESS)
      expect(result.isOk()).toBe(true)
      expect(seen.length).toBe(1)
      const action = (seen[0] as { action: Record<string, unknown> }).action
      expect(action.type).toBe('userDexAbstraction')
      expect(action.enabled).toBe(true)
      expect(String(action.user).toLowerCase()).toBe(USER_ADDRESS.toLowerCase())
      expect(action.hyperliquidChain).toBe('Testnet')
    })

    it('returns errAsync(HyperliquidGatewayError) when the SDK throws', async () => {
      const httpTransport = fakeRequestTransport(() =>
        Promise.reject(
          new HttpRequestError({
            response: new Response(null, { status: 500 }),
            message: 'server error',
          }),
        ),
      )
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      const result = await gateway.enableDexAbstraction(masterWallet, USER_ADDRESS)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('network')
    })
  })

  describe('queryUserAbstraction', () => {
    const USER_ADDRESS = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress

    it('returns the account abstraction mode from the info endpoint', async () => {
      const httpTransport = fakeRequestTransport(async () => 'dexAbstraction')
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.queryUserAbstraction(USER_ADDRESS)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toBe('dexAbstraction')
    })
  })

  describe('usdClassTransfer', () => {
    it('returns okAsync(undefined) on success', async () => {
      const httpTransport = fakeRequestTransport(async () => ({
        status: 'ok',
        response: { type: 'default' },
      }))
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      const result = await gateway.usdClassTransfer(masterWallet, { amount: '10', toPerp: true })
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toBeUndefined()
    })

    it('signs and POSTs a usdClassTransfer action carrying amount + toPerp (Spot→Perp)', async () => {
      const seen: Array<Record<string, unknown>> = []
      const httpTransport = fakeRequestTransport(async (payload) => {
        seen.push(payload as Record<string, unknown>)
        return { status: 'ok', response: { type: 'default' } }
      })
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      const result = await gateway.usdClassTransfer(masterWallet, { amount: '25', toPerp: true })
      expect(result.isOk()).toBe(true)
      expect(seen.length).toBe(1)
      const action = (seen[0] as { action: Record<string, unknown> }).action
      expect(action.type).toBe('usdClassTransfer')
      expect(action.amount).toBe('25')
      expect(action.toPerp).toBe(true)
      expect(action.hyperliquidChain).toBe('Testnet')
    })

    it('carries toPerp=false for a Perp→Spot transfer', async () => {
      const seen: Array<Record<string, unknown>> = []
      const httpTransport = fakeRequestTransport(async (payload) => {
        seen.push(payload as Record<string, unknown>)
        return { status: 'ok', response: { type: 'default' } }
      })
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      await gateway.usdClassTransfer(masterWallet, { amount: '5.5', toPerp: false })
      const action = (seen[0] as { action: Record<string, unknown> }).action
      expect(action.toPerp).toBe(false)
      expect(action.amount).toBe('5.5')
    })

    it('returns errAsync(HyperliquidGatewayError) when the SDK throws', async () => {
      const httpTransport = fakeRequestTransport(() =>
        Promise.reject(
          new HttpRequestError({
            response: new Response(null, { status: 500 }),
            message: 'server error',
          }),
        ),
      )
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      const result = await gateway.usdClassTransfer(masterWallet, { amount: '10', toPerp: true })
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('network')
    })
  })

  describe('withdraw3', () => {
    const DESTINATION = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress

    it('signs and POSTs a withdraw3 action carrying destination + amount, mapping ok→ok', async () => {
      const seen: Array<Record<string, unknown>> = []
      const httpTransport = fakeRequestTransport(async (payload) => {
        seen.push(payload as Record<string, unknown>)
        return { status: 'ok', response: { type: 'default' } }
      })
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      const result = await gateway.withdraw3(masterWallet, { destination: DESTINATION, amount: '25' })
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toBeUndefined()
      expect(seen.length).toBe(1)
      const action = (seen[0] as { action: Record<string, unknown> }).action
      expect(action.type).toBe('withdraw3')
      expect(action.amount).toBe('25')
      expect(String(action.destination).toLowerCase()).toBe(DESTINATION.toLowerCase())
    })

    it('returns errAsync(HyperliquidGatewayError) when the SDK throws', async () => {
      const httpTransport = fakeRequestTransport(() =>
        Promise.reject(
          new HttpRequestError({
            response: new Response(null, { status: 500 }),
            message: 'server error',
          }),
        ),
      )
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      const result = await gateway.withdraw3(masterWallet, { destination: DESTINATION, amount: '10' })
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('network')
    })
  })

  describe('usdSend', () => {
    const DESTINATION = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress

    it('signs and POSTs a usdSend action carrying destination + amount, mapping ok→ok', async () => {
      const seen: Array<Record<string, unknown>> = []
      const httpTransport = fakeRequestTransport(async (payload) => {
        seen.push(payload as Record<string, unknown>)
        return { status: 'ok', response: { type: 'default' } }
      })
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      const result = await gateway.usdSend(masterWallet, { destination: DESTINATION, amount: '25' })
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toBeUndefined()
      expect(seen.length).toBe(1)
      const action = (seen[0] as { action: Record<string, unknown> }).action
      expect(action.type).toBe('usdSend')
      expect(action.amount).toBe('25')
      expect(String(action.destination).toLowerCase()).toBe(DESTINATION.toLowerCase())
    })

    it('returns errAsync(HyperliquidGatewayError) when the SDK throws', async () => {
      const httpTransport = fakeRequestTransport(() =>
        Promise.reject(
          new HttpRequestError({
            response: new Response(null, { status: 500 }),
            message: 'server error',
          }),
        ),
      )
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      const result = await gateway.usdSend(masterWallet, { destination: DESTINATION, amount: '10' })
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('network')
    })
  })

  describe('spotSend', () => {
    const DESTINATION = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress
    const TOKEN = 'USDC:0xeb62eee3685fc4c43992febcd9e75443'

    it('signs and POSTs a spotSend action carrying destination + token + amount, mapping ok→ok', async () => {
      const seen: Array<Record<string, unknown>> = []
      const httpTransport = fakeRequestTransport(async (payload) => {
        seen.push(payload as Record<string, unknown>)
        return { status: 'ok', response: { type: 'default' } }
      })
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      const result = await gateway.spotSend(masterWallet, {
        destination: DESTINATION,
        token: TOKEN,
        amount: '25',
      })
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toBeUndefined()
      expect(seen.length).toBe(1)
      const action = (seen[0] as { action: Record<string, unknown> }).action
      expect(action.type).toBe('spotSend')
      expect(action.amount).toBe('25')
      expect(action.token).toBe(TOKEN)
      expect(String(action.destination).toLowerCase()).toBe(DESTINATION.toLowerCase())
    })

    it('returns errAsync(HyperliquidGatewayError) when the SDK throws', async () => {
      const httpTransport = fakeRequestTransport(() =>
        Promise.reject(
          new HttpRequestError({
            response: new Response(null, { status: 500 }),
            message: 'server error',
          }),
        ),
      )
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      const result = await gateway.spotSend(masterWallet, {
        destination: DESTINATION,
        token: TOKEN,
        amount: '10',
      })
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('network')
    })
  })

  describe('queryMaxBuilderFee', () => {
    const USER_ADDRESS = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress

    it('returns the numeric approved rate (tenths of bps) on success', async () => {
      const httpTransport = fakeRequestTransport(async () => 35)
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.queryMaxBuilderFee(USER_ADDRESS)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toBe(35)
    })

    it('returns 0 when the user has no approval yet', async () => {
      const httpTransport = fakeRequestTransport(async () => 0)
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.queryMaxBuilderFee(USER_ADDRESS)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toBe(0)
    })

    it('sends type=maxBuilderFee with the user and the builder address from HYPERLIQUID_BUILDER', async () => {
      const seen: Array<Record<string, unknown>> = []
      const httpTransport = fakeRequestTransport(async (payload) => {
        seen.push(payload as Record<string, unknown>)
        return 35
      })
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      await gateway.queryMaxBuilderFee(USER_ADDRESS)
      expect(seen.length).toBe(1)
      const req = seen[0]
      expect(req.type).toBe('maxBuilderFee')
      expect(String(req.user).toLowerCase()).toBe(USER_ADDRESS.toLowerCase())
      expect(String(req.builder).toLowerCase()).toBe(
        '0xff9be883a670afe4c1e8dcb2fc05afb2caecd6b7',
      )
    })

    it('returns errAsync(HyperliquidGatewayError) when the info endpoint throws', async () => {
      const httpTransport = fakeRequestTransport(() =>
        Promise.reject(
          new HttpRequestError({
            response: new Response(null, { status: 500 }),
            message: 'server error',
          }),
        ),
      )
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.queryMaxBuilderFee(USER_ADDRESS)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('network')
    })
  })

  describe('queryAgents', () => {
    const USER_ADDRESS = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress

    it('returns the projected array of { address, name, validUntil } on success', async () => {
      const validUntil = Date.now() + 86_400_000
      const httpTransport = fakeRequestTransport(async () => [
        {
          address: '0x1111111111111111111111111111111111111111',
          name: 'desktop',
          validUntil,
        },
        {
          address: '0x2222222222222222222222222222222222222222',
          name: 'mobile',
          validUntil,
        },
      ])
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.queryAgents(USER_ADDRESS)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveLength(2)
        expect(result.value[0]?.address).toBe('0x1111111111111111111111111111111111111111')
        expect(result.value[0]?.name).toBe('desktop')
        expect(result.value[1]?.name).toBe('mobile')
        // validUntil is kept since ADR-0036 — the slots-full victim picker
        // renders each agent's expiry.
        expect(result.value[0]?.validUntil).toBe(validUntil)
      }
    })

    it('returns an empty array when the user has no agents', async () => {
      const httpTransport = fakeRequestTransport(async () => [])
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.queryAgents(USER_ADDRESS)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toEqual([])
    })

    it('sends type=extraAgents with the user address', async () => {
      const seen: Array<Record<string, unknown>> = []
      const httpTransport = fakeRequestTransport(async (payload) => {
        seen.push(payload as Record<string, unknown>)
        return []
      })
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      await gateway.queryAgents(USER_ADDRESS)
      expect(seen.length).toBe(1)
      const req = seen[0]
      expect(req.type).toBe('extraAgents')
      expect(String(req.user).toLowerCase()).toBe(USER_ADDRESS.toLowerCase())
    })

    it('returns errAsync(HyperliquidGatewayError) when the info endpoint throws', async () => {
      const httpTransport = fakeRequestTransport(() =>
        Promise.reject(
          new HttpRequestError({
            response: new Response(null, { status: 500 }),
            message: 'server error',
          }),
        ),
      )
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.queryAgents(USER_ADDRESS)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('network')
    })
  })

  describe('queryApprovedBuilders', () => {
    const USER_ADDRESS = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress

    it('returns the lowercased branded builder addresses on success', async () => {
      const httpTransport = fakeRequestTransport(async () => [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
      ])
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.queryApprovedBuilders(USER_ADDRESS)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toEqual([
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ])
      }
    })

    it('sends type=approvedBuilders with the user address', async () => {
      const seen: Array<Record<string, unknown>> = []
      const httpTransport = fakeRequestTransport(async (payload) => {
        seen.push(payload as Record<string, unknown>)
        return []
      })
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      await gateway.queryApprovedBuilders(USER_ADDRESS)
      expect(seen.length).toBe(1)
      const req = seen[0]
      expect(req.type).toBe('approvedBuilders')
      expect(String(req.user).toLowerCase()).toBe(USER_ADDRESS.toLowerCase())
    })

    it('returns errAsync(HyperliquidGatewayError) when the info endpoint throws', async () => {
      const httpTransport = fakeRequestTransport(() =>
        Promise.reject(
          new HttpRequestError({
            response: new Response(null, { status: 500 }),
            message: 'server error',
          }),
        ),
      )
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.queryApprovedBuilders(USER_ADDRESS)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('network')
    })
  })

  describe('revokeBuilderFee', () => {
    const VICTIM_BUILDER = '0x3333333333333333333333333333333333333333' as WalletAddress

    it('sends an approveBuilderFee action at maxFeeRate 0% for the victim builder (ADR-0036 D-4)', async () => {
      const seen: Array<Record<string, unknown>> = []
      const httpTransport = fakeRequestTransport(async (payload) => {
        seen.push(payload as Record<string, unknown>)
        return { status: 'ok', response: { type: 'default' } }
      })
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      const result = await gateway.revokeBuilderFee(masterWallet, VICTIM_BUILDER)
      expect(result.isOk()).toBe(true)
      expect(seen.length).toBe(1)
      const action = (seen[0] as { action: Record<string, unknown> }).action
      expect(action.type).toBe('approveBuilderFee')
      expect(action.maxFeeRate).toBe('0%')
      expect(String(action.builder).toLowerCase()).toBe(VICTIM_BUILDER)
    })

    it('returns errAsync(HyperliquidGatewayError) when SDK throws', async () => {
      const httpTransport = fakeRequestTransport(() =>
        Promise.reject(
          new HttpRequestError({
            response: new Response(null, { status: 500 }),
            message: 'server error',
          }),
        ),
      )
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const masterWallet = makeFakeWalletClient() as never as WalletClient
      const result = await gateway.revokeBuilderFee(masterWallet, VICTIM_BUILDER)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('network')
    })
  })

  describe('queryHasEverFunded', () => {
    const USER_ADDRESS = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress
    const HASH = `0x${'a'.repeat(64)}`

    it('returns ok(true) when the ledger history contains a deposit delta', async () => {
      const httpTransport = fakeRequestTransport(async () => [
        { time: 1_700_000_000_000, hash: HASH, delta: { type: 'deposit', usdc: '100.0' } },
        { time: 1_700_000_100_000, hash: HASH, delta: { type: 'withdraw', usdc: '40.0', nonce: 1, fee: '1.0' } },
      ])
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.queryHasEverFunded(USER_ADDRESS)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toBe(true)
    })

    // Regression for the transfer-funded account (real ledger that surfaced the
    // bug: USDC arrived via spotTransfer and was vault-deposited, with NO
    // `deposit` row). ADR-0027 (amended): any ledger entry ⇒ ever funded.
    it('returns ok(true) for a transfer-funded account with no deposit delta', async () => {
      const httpTransport = fakeRequestTransport(async () => [
        { time: 1_764_073_568_043, hash: HASH, delta: { type: 'accountActivationGas', usdc: '0.03' } },
        {
          time: 1_764_073_568_043,
          hash: HASH,
          delta: {
            type: 'spotTransfer',
            token: 'USDC',
            amount: '0.4',
            usdcValue: '0.4',
            user: '0x2222222222222222222222222222222222222222',
            destination: USER_ADDRESS,
            fee: '0.0',
            nativeTokenFee: '0.0',
            nonce: null,
            feeToken: 'USDC',
          },
        },
        { time: 1_764_079_550_768, hash: HASH, delta: { type: 'vaultDeposit', vault: '0x3333333333333333333333333333333333333333', usdc: '11.8' } },
      ])
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.queryHasEverFunded(USER_ADDRESS)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toBe(true)
    })

    it('stays ok(true) even when the account was later fully withdrawn (milestone does not reopen)', async () => {
      // A deposit followed by a withdrawal emptying the account: First Deposit
      // is satisfied by history, regardless of current balance (ADR-0027).
      const httpTransport = fakeRequestTransport(async () => [
        { time: 1_700_000_000_000, hash: HASH, delta: { type: 'deposit', usdc: '100.0' } },
        { time: 1_700_000_200_000, hash: HASH, delta: { type: 'withdraw', usdc: '100.0', nonce: 2, fee: '1.0' } },
      ])
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.queryHasEverFunded(USER_ADDRESS)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toBe(true)
    })

    it('returns ok(false) when the non-funding ledger is empty (never funded)', async () => {
      const httpTransport = fakeRequestTransport(async () => [])
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.queryHasEverFunded(USER_ADDRESS)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toBe(false)
    })

    it('queries userNonFundingLedgerUpdates for the user from startTime 0', async () => {
      const seen: Array<Record<string, unknown>> = []
      const httpTransport = fakeRequestTransport(async (payload) => {
        seen.push(payload as Record<string, unknown>)
        return []
      })
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      await gateway.queryHasEverFunded(USER_ADDRESS)
      expect(seen.length).toBe(1)
      const req = seen[0]
      expect(req.type).toBe('userNonFundingLedgerUpdates')
      expect(String(req.user).toLowerCase()).toBe(USER_ADDRESS.toLowerCase())
      expect(req.startTime).toBe(0)
    })

    it('returns errAsync(HyperliquidGatewayError) when the SDK rejects', async () => {
      const httpTransport = fakeRequestTransport(() =>
        Promise.reject(
          new HttpRequestError({
            response: new Response(null, { status: 500 }),
            message: 'server error',
          }),
        ),
      )
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.queryHasEverFunded(USER_ADDRESS)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('network')
    })
  })

  describe('placeOrder', () => {
    const ORDER_PARAMS = {
      orders: [
        {
          a: 0,
          b: true,
          p: '100000',
          s: '0.1',
          r: false,
          t: { limit: { tif: 'Gtc' as const } },
          c: `0xa99a${'0'.repeat(28)}` as `0x${string}`,
        },
      ],
      grouping: 'na' as const,
      builder: { b: '0xb84168cf3be63c6b8dad05ff5d755e97432ff80b' as `0x${string}`, f: 35 },
    }

    it('signs and POSTs the order action verbatim, returning the success response', async () => {
      const seen: Array<{ action: Record<string, unknown> }> = []
      const httpTransport = fakeRequestTransport(async (payload) => {
        seen.push(payload as { action: Record<string, unknown> })
        return {
          status: 'ok',
          response: { type: 'order', data: { statuses: [{ resting: { oid: 7 } }] } },
        }
      })
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.placeOrder(makeFakeWalletClient() as never, ORDER_PARAMS)
      expect(result.isOk()).toBe(true)
      expect(seen.length).toBe(1)
      const action = seen[0]!.action
      expect(action.type).toBe('order')
      expect(action.grouping).toBe('na')
      const orders = action.orders as Array<Record<string, unknown>>
      expect(orders[0]!.a).toBe(0)
      expect(orders[0]!.s).toBe('0.1')
      expect(action.builder).toEqual({ b: '0xb84168cf3be63c6b8dad05ff5d755e97432ff80b', f: 35 })
    })

    it('returns errAsync(HyperliquidGatewayError) when the API rejects', async () => {
      const httpTransport = fakeRequestTransport(() =>
        Promise.reject(
          new HttpRequestError({
            response: new Response(null, { status: 500 }),
            message: 'server error',
          }),
        ),
      )
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.placeOrder(makeFakeWalletClient() as never, ORDER_PARAMS)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('network')
    })
  })

  describe('cancelOrder / cancelOrderByCloid / modifyOrder', () => {
    it('cancelOrder signs and POSTs a cancel action with (a, o)', async () => {
      const seen: Array<{ action: Record<string, unknown> }> = []
      const httpTransport = fakeRequestTransport(async (payload) => {
        seen.push(payload as { action: Record<string, unknown> })
        return { status: 'ok', response: { type: 'cancel', data: { statuses: ['success'] } } }
      })
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.cancelOrder(makeFakeWalletClient() as never, {
        cancels: [{ a: 0, o: 555 }],
      })
      expect(result.isOk()).toBe(true)
      expect(seen[0]!.action.type).toBe('cancel')
      expect(seen[0]!.action.cancels).toEqual([{ a: 0, o: 555 }])
    })

    it('cancelOrderByCloid signs and POSTs a cancelByCloid action with (asset, cloid)', async () => {
      const cloid = `0xa99a${'0'.repeat(28)}` as `0x${string}`
      const seen: Array<{ action: Record<string, unknown> }> = []
      const httpTransport = fakeRequestTransport(async (payload) => {
        seen.push(payload as { action: Record<string, unknown> })
        return { status: 'ok', response: { type: 'cancel', data: { statuses: ['success'] } } }
      })
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.cancelOrderByCloid(makeFakeWalletClient() as never, {
        cancels: [{ asset: 0, cloid }],
      })
      expect(result.isOk()).toBe(true)
      expect(seen[0]!.action.type).toBe('cancelByCloid')
      expect(seen[0]!.action.cancels).toEqual([{ asset: 0, cloid }])
    })

    it('modifyOrder signs and POSTs a modify action with oid + order', async () => {
      const seen: Array<{ action: Record<string, unknown> }> = []
      const httpTransport = fakeRequestTransport(async (payload) => {
        seen.push(payload as { action: Record<string, unknown> })
        return { status: 'ok', response: { type: 'default' } }
      })
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.modifyOrder(makeFakeWalletClient() as never, {
        oid: 555,
        order: { a: 0, b: true, p: '96000', s: '2', r: false, t: { limit: { tif: 'Gtc' } } },
      })
      expect(result.isOk()).toBe(true)
      expect(seen[0]!.action.type).toBe('modify')
      expect(seen[0]!.action.oid).toBe(555)
    })
  })

  describe('cancelTwap', () => {
    it('signs and POSTs a twapCancel action with (a, t)', async () => {
      const seen: Array<{ action: Record<string, unknown> }> = []
      const httpTransport = fakeRequestTransport(async (payload) => {
        seen.push(payload as { action: Record<string, unknown> })
        return { status: 'ok', response: { type: 'twapCancel', data: { status: 'success' } } }
      })
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.cancelTwap(makeFakeWalletClient() as never, { a: 4, t: 99 })
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.response.data.status).toBe('success')
      }
      expect(seen.length).toBe(1)
      const action = seen[0]!.action
      expect(action.type).toBe('twapCancel')
      expect(action.a).toBe(4)
      expect(action.t).toBe(99)
    })

    it('returns errAsync(HyperliquidGatewayError) when the API rejects', async () => {
      const httpTransport = fakeRequestTransport(() =>
        Promise.reject(
          new HttpRequestError({
            response: new Response(null, { status: 500 }),
            message: 'server error',
          }),
        ),
      )
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.cancelTwap(makeFakeWalletClient() as never, { a: 0, t: 1 })
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('network')
    })
  })

  describe('formatPrice / formatSize', () => {
    const gateway = createNktkasHyperliquidExchangeGateway({
      isTestnet: true,
      httpTransport: fakeRequestTransport(async () => ({})),
      logger: buildFakeLogger().logger,
    })

    it('rounds a perp price to 5 significant figures', () => {
      const result = gateway.formatPrice(105010.5, 5, 'perp')
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toBe('105010')
    })

    it('truncates a size to szDecimals', () => {
      const result = gateway.formatSize(0.123456789, 5)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toBe('0.12345')
    })

    it('returns err when the SDK rejects a zero / invalid result', () => {
      const result = gateway.formatSize(0, 5)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('invalid-response')
    })
  })

  describe('signL1Action', () => {
    it('returns ok(Signature) on success', async () => {
      const httpTransport = fakeRequestTransport(async () => ({ status: 'ok' }))
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const agentWallet = makeFakeWalletClient() as never
      const action = { type: 'order', orders: [] }
      const result = await gateway.signL1Action(agentWallet, action, Date.now())
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toHaveProperty('r')
        expect(result.value).toHaveProperty('s')
        expect(result.value).toHaveProperty('v')
      }
    })

    it('returns errAsync(HyperliquidGatewayError) when signing throws', async () => {
      const httpTransport = fakeRequestTransport(async () => ({ status: 'ok' }))
      const gateway = createNktkasHyperliquidExchangeGateway({
        isTestnet: true,
        httpTransport,
        logger: buildFakeLogger().logger,
      })
      const brokenWallet: FakeViemWalletClient = {
        signTypedData: brokenSignTypedData as FakeViemWalletClient['signTypedData'],
        getAddresses: async () => ['0xabcdef0123456789abcdef0123456789abcdef01' as `0x${string}`],
        getChainId: async () => 8453,
        address: '0xabcdef0123456789abcdef0123456789abcdef01' as `0x${string}`,
      }
      const action = { type: 'order', orders: [] }
      const result = await gateway.signL1Action(brokenWallet as never, action, Date.now())
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.kind).toBe('network')
      }
    })
  })
})
