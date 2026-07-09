import { describe, it, expect } from 'vitest'
import { createDefaultBaseUsdcBalanceReader } from '../base-public-client'
import { createDedupUsdcBalanceReader } from '../dedup-usdc-balance-reader'
import { createBaseUsdcBalanceReader } from '../base-usdc-balance-reader'
import type { AgentWalletAddress } from '../../agent-balance.types'
import { buildCountingUsdcBalanceClient } from '../__fixtures__/fake-usdc-balance-client'

const ADDRESS_A: AgentWalletAddress =
  '0x1111111111111111111111111111111111111111'
const ADDRESS_B: AgentWalletAddress =
  '0x2222222222222222222222222222222222222222'

describe('createDefaultBaseUsdcBalanceReader (singleton)', () => {
  it('returns the same instance across calls (lazily-created singleton)', () => {
    const first = createDefaultBaseUsdcBalanceReader()
    const second = createDefaultBaseUsdcBalanceReader()

    expect(first).toBe(second)
  })
})

describe('createDedupUsdcBalanceReader (in-flight de-dup)', () => {
  it('coalesces concurrent reads of the same address onto one readContract', async () => {
    const client = buildCountingUsdcBalanceClient({
      rawBalanceByAddress: { [ADDRESS_A]: 12_500000n },
    })
    const reader = createDedupUsdcBalanceReader(
      createBaseUsdcBalanceReader({ client }),
    )

    const firstRead = reader.readUsdcBalance(ADDRESS_A)
    const secondRead = reader.readUsdcBalance(ADDRESS_A)

    expect(client.callCountFor(ADDRESS_A)).toBe(1)

    client.resolveAll()
    const [first, second] = await Promise.all([firstRead, secondRead])

    expect(first.isOk()).toBe(true)
    expect(second.isOk()).toBe(true)
    if (first.isOk() && second.isOk()) {
      expect(first.value).toBe(12.5)
      expect(second.value).toBe(12.5)
    }
  })

  it('does not coalesce reads of different addresses', () => {
    const client = buildCountingUsdcBalanceClient()
    const reader = createDedupUsdcBalanceReader(
      createBaseUsdcBalanceReader({ client }),
    )

    void reader.readUsdcBalance(ADDRESS_A)
    void reader.readUsdcBalance(ADDRESS_B)

    expect(client.callCountFor(ADDRESS_A)).toBe(1)
    expect(client.callCountFor(ADDRESS_B)).toBe(1)
    expect(client.callCount()).toBe(2)
  })

  it('does not cache a failure as success (a later read re-hits the client)', async () => {
    const failingClient = {
      readContract: () => Promise.reject(new Error('rpc down')),
    }
    const reader = createDedupUsdcBalanceReader(
      createBaseUsdcBalanceReader({ client: failingClient }),
    )

    const first = await reader.readUsdcBalance(ADDRESS_A)
    expect(first.isErr()).toBe(true)
  })
})
