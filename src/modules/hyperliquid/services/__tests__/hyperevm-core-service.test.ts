import { describe, expect, it, vi } from 'vitest'
import { parseUnits, UserRejectedRequestError, type Chain, type PublicClient, type WalletClient } from 'viem'
import type { WalletAddress } from '@/modules/shared/domain'
import { createHyperEvmCoreService } from '../hyperevm-core-service'
import { defineHyperEvmChain, HYPE_SYSTEM_ADDRESS } from '../hyperevm.constants'

const ADDRESS = '0x1111111111111111111111111111111111111111' as WalletAddress
const CONTRACT = '0x8f254b963e8468305d409b33aa137c67aabbccdd' as `0x${string}`
const SYSTEM_ADDR = '0x20000000000000000000000000000000000000c5' as WalletAddress
const HASH = '0xabc' as `0x${string}`

const CHAIN: Chain = defineHyperEvmChain('mainnet', 'https://rpc.hyperliquid.xyz/evm')

const SILENT_LOGGER = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => SILENT_LOGGER,
}

function buildService(overrides: {
  publicClient?: Partial<PublicClient>
} = {}) {
  const publicClient = {
    getBalance: vi.fn(async () => parseUnits('3', 18)),
    readContract: vi.fn(async () => parseUnits('5', 8)),
    waitForTransactionReceipt: vi.fn(async () => ({ status: 'success' })),
    ...overrides.publicClient,
  } as unknown as PublicClient
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test logger satisfies the Logger shape structurally
  const service = createHyperEvmCoreService({ publicClient, chain: CHAIN, logger: SILENT_LOGGER as any })
  return { service, publicClient }
}

function buildWallet(overrides: Partial<WalletClient> & { account?: unknown } = {}): WalletClient {
  return {
    account: { address: ADDRESS },
    getChainId: vi.fn(async () => 999),
    switchChain: vi.fn(async () => undefined),
    addChain: vi.fn(async () => undefined),
    writeContract: vi.fn(async () => HASH),
    sendTransaction: vi.fn(async () => HASH),
    ...overrides,
  } as unknown as WalletClient
}

describe('createHyperEvmCoreService — reads', () => {
  it('readNativeBalance formats the wallet HYPE balance at 18 decimals', async () => {
    const { service } = buildService()
    const result = await service.readNativeBalance(ADDRESS)
    expect(result.isOk() && result.value).toBe(3)
  })

  it('readErc20Balance formats balanceOf at the given decimals', async () => {
    const { service } = buildService()
    const result = await service.readErc20Balance(CONTRACT, ADDRESS, 8)
    expect(result.isOk() && result.value).toBe(5)
  })
})

describe('createHyperEvmCoreService — readChainId', () => {
  it('reads the connected wallet chain id (the wrong-chain preflight + post-switch verify source)', async () => {
    const { service } = buildService()
    const wallet = buildWallet({ getChainId: vi.fn(async () => 999) })
    const result = await service.readChainId(wallet)
    expect(result.isOk() && result.value).toBe(999)
  })
})

describe('createHyperEvmCoreService — transfers', () => {
  it('transferErc20 writes transfer(systemAddress, rawAmount) and returns the mined hash', async () => {
    const { service } = buildService()
    const wallet = buildWallet()
    const rawAmount = parseUnits('1', 8)
    const result = await service.transferErc20(wallet, {
      contract: CONTRACT,
      systemAddress: SYSTEM_ADDR,
      rawAmount,
    })
    expect(result.isOk() && result.value.transactionHash).toBe(HASH)
    expect(wallet.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: CONTRACT,
        functionName: 'transfer',
        args: [SYSTEM_ADDR, rawAmount],
      }),
    )
  })

  it('sendNativeHype sends value to the HYPE system address', async () => {
    const { service } = buildService()
    const wallet = buildWallet()
    const weiAmount = parseUnits('2', 18)
    const result = await service.sendNativeHype(wallet, { to: HYPE_SYSTEM_ADDRESS, weiAmount })
    expect(result.isOk() && result.value.transactionHash).toBe(HASH)
    expect(wallet.sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ to: HYPE_SYSTEM_ADDRESS, value: weiAmount }),
    )
  })

  it('maps a user-rejected transfer to wallet-rejected (non-destructive)', async () => {
    const { service } = buildService()
    const writeContract = vi.fn().mockRejectedValue(new UserRejectedRequestError(new Error('no')))
    const wallet = buildWallet({ writeContract })
    const result = await service.transferErc20(wallet, {
      contract: CONTRACT,
      systemAddress: SYSTEM_ADDR,
      rawAmount: 1n,
    })
    expect(result.isErr() && result.error.kind).toBe('wallet-rejected')
  })

  it('returns wallet-unavailable when the wallet has no account', async () => {
    const { service } = buildService()
    const wallet = buildWallet({ account: undefined })
    const result = await service.sendNativeHype(wallet, {
      to: HYPE_SYSTEM_ADDRESS,
      weiAmount: 1n,
    })
    expect(result.isErr() && result.error.kind).toBe('wallet-unavailable')
  })
})
