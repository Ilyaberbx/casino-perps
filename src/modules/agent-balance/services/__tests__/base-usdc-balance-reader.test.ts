import { describe, it, expect } from 'vitest'
import { createBaseUsdcBalanceReader } from '../base-usdc-balance-reader'
import type { AgentWalletAddress } from '../../agent-balance.types'
import { buildFakeUsdcBalanceClient } from '../__fixtures__/fake-usdc-balance-client'

const AGENT_WALLET: AgentWalletAddress =
  '0x1111111111111111111111111111111111111111'

describe('createBaseUsdcBalanceReader', () => {
  it('converts a raw 6-decimal USDC bigint to a dollar number (ok)', async () => {
    const client = buildFakeUsdcBalanceClient({ rawBalance: 12_500000n })
    const reader = createBaseUsdcBalanceReader({ client })

    const result = await reader.readUsdcBalance(AGENT_WALLET)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toBe(12.5)
  })

  it('treats a zero balance as $0 (ok)', async () => {
    const client = buildFakeUsdcBalanceClient({ rawBalance: 0n })
    const reader = createBaseUsdcBalanceReader({ client })

    const result = await reader.readUsdcBalance(AGENT_WALLET)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toBe(0)
  })

  it('returns err (does not throw) when the RPC rejects', async () => {
    const client = buildFakeUsdcBalanceClient({ reject: new Error('rpc down') })
    const reader = createBaseUsdcBalanceReader({ client })

    const result = await reader.readUsdcBalance(AGENT_WALLET)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('balance-read-failed')
  })
})
