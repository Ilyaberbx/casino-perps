import { describe, expect, it, vi } from 'vitest'
import { UserRejectedRequestError } from 'viem'
import type { WalletAddress } from '@/modules/shared/domain'
import { createHyperliquidDepositService } from '../hyperliquid-deposit-service'
import { HYPERLIQUID_BRIDGE2_ADDRESS } from '../hyperliquid-deposit.constants'
import {
  buildFakeLogger,
  buildFakePublicClient,
  buildFakeWalletClient,
} from '../__fixtures__/fake-deposit-clients'

const ADDRESS = '0x1111111111111111111111111111111111111111' as WalletAddress

function makeService(
  publicOverrides = {},
): ReturnType<typeof createHyperliquidDepositService> {
  const { logger } = buildFakeLogger()
  return createHyperliquidDepositService({
    publicClient: buildFakePublicClient(publicOverrides),
    logger,
  })
}

describe('createHyperliquidDepositService', () => {
  describe('readBalances', () => {
    it('converts 6-decimal USDC and 18-decimal ETH raw values to whole units', async () => {
      const service = makeService({
        // 12.5 USDC at 6 decimals, 0.001 ETH at 18 decimals
        readContract: () => Promise.resolve(12_500_000n),
        getBalance: () => Promise.resolve(1_000_000_000_000_000n),
      })
      const result = await service.readBalances(ADDRESS)
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toEqual({ usdc: 12.5, ethForGas: 0.001 })
    })

    it('maps a failed balanceOf read to balance-read-failed', async () => {
      const service = makeService({
        readContract: () => Promise.reject(new Error('rpc down')),
      })
      const result = await service.readBalances(ADDRESS)
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().kind).toBe('balance-read-failed')
    })
  })

  describe('readChainId', () => {
    it('returns the wallet chain id', async () => {
      const service = makeService()
      const wallet = buildFakeWalletClient({ getChainId: () => Promise.resolve(1) })
      const result = await service.readChainId(wallet)
      expect(result._unsafeUnwrap()).toBe(1)
    })
  })

  describe('transfer', () => {
    it('writes USDC.transfer(BRIDGE2, amount) scaled to 6 decimals and waits for the receipt', async () => {
      const writeContract = vi.fn((args: unknown) => {
        void args
        return Promise.resolve('0xabc' as `0x${string}`)
      })
      const waitForTransactionReceipt = vi.fn((args: unknown) => {
        void args
        return Promise.resolve({ status: 'success' })
      })
      const { logger } = buildFakeLogger()
      const service = createHyperliquidDepositService({
        publicClient: buildFakePublicClient({ waitForTransactionReceipt }),
        logger,
      })
      const wallet = buildFakeWalletClient({ writeContract })

      const result = await service.transfer(wallet, 7.5)

      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toEqual({ transactionHash: '0xabc' })
      const callArgs = writeContract.mock.calls[0][0] as {
        functionName: string
        args: [string, bigint]
      }
      expect(callArgs.functionName).toBe('transfer')
      expect(callArgs.args[0]).toBe(HYPERLIQUID_BRIDGE2_ADDRESS)
      expect(callArgs.args[1]).toBe(7_500_000n)
      expect(waitForTransactionReceipt).toHaveBeenCalledWith({ hash: '0xabc' })
    })

    it('maps a user-rejected transfer to wallet-rejected (pre-broadcast)', async () => {
      const service = makeService()
      const wallet = buildFakeWalletClient({
        writeContract: () =>
          Promise.reject(new UserRejectedRequestError(new Error('rejected'))),
      })
      const result = await service.transfer(wallet, 10)
      expect(result._unsafeUnwrapErr().kind).toBe('wallet-rejected')
    })

    it('maps a non-rejection transfer failure to transfer-failed', async () => {
      const service = makeService()
      const wallet = buildFakeWalletClient({
        writeContract: () => Promise.reject(new Error('insufficient funds')),
      })
      const result = await service.transfer(wallet, 10)
      expect(result._unsafeUnwrapErr().kind).toBe('transfer-failed')
    })

    it('errors with wallet-unavailable when the wallet has no account', async () => {
      const service = makeService()
      const wallet = buildFakeWalletClient({ account: undefined })
      const result = await service.transfer(wallet, 10)
      expect(result._unsafeUnwrapErr().kind).toBe('wallet-unavailable')
    })

    it('maps a receipt-wait failure to transfer-failed', async () => {
      const service = makeService({
        waitForTransactionReceipt: () => Promise.reject(new Error('dropped')),
      })
      const wallet = buildFakeWalletClient({
        writeContract: () => Promise.resolve('0xabc' as `0x${string}`),
      })
      const result = await service.transfer(wallet, 10)
      expect(result._unsafeUnwrapErr().kind).toBe('transfer-failed')
    })
  })
})
