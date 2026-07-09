import { describe, it, expect } from 'vitest'
import { okAsync } from 'neverthrow'
import type { WalletAddress } from '@/modules/shared/domain'
import type { HyperliquidGateway } from '../../gateway/hyperliquid-gateway.types'
import type { UserTwapSliceFillsByTimeResponse } from '../../gateway/sdk-types'
import {
  createHyperliquidTwapSliceFillsReader,
  projectTwapSliceFills,
} from '../twap-slice-fills-reader'
import { buildFakeLogger } from '../__fixtures__/web-data2'

const ADDRESS = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress

function fakeFill(overrides: Record<string, unknown> = {}) {
  return {
    coin: 'BTC',
    px: '50000.0',
    sz: '0.25',
    side: 'B',
    time: 1_700_000_000_000,
    startPosition: '0.0',
    dir: 'Open Long',
    closedPnl: '12.5',
    hash: `0x${'a'.repeat(64)}`,
    oid: 1,
    crossed: true,
    fee: '1.25',
    tid: 42,
    feeToken: 'USDC',
    ...overrides,
  }
}

describe('projectTwapSliceFills', () => {
  it('projects HL slice fills into the shared Fill shape', () => {
    const response = [
      { fill: fakeFill(), twapId: 7 },
    ] as unknown as UserTwapSliceFillsByTimeResponse
    const out = projectTwapSliceFills(response)
    expect(out).toHaveLength(1)
    const fill = out[0]!
    expect(fill.symbol).toBe('BTC')
    expect(fill.side).toBe('buy')
    expect(fill.price).toBe(50_000)
    expect(fill.size).toBe(0.25)
    expect(fill.fee).toBe(1.25)
    expect(fill.timestamp).toBe(1_700_000_000_000)
    expect(fill.closedPnl).toBe(12.5)
    expect(fill.direction).toBe('Open Long')
    expect(fill.feeToken).toBe('USDC')
  })

  it("maps side 'A' to sell", () => {
    const response = [
      { fill: fakeFill({ side: 'A' }), twapId: 1 },
    ] as unknown as UserTwapSliceFillsByTimeResponse
    expect(projectTwapSliceFills(response)[0]!.side).toBe('sell')
  })

  it('produces a stable identifier combining tid and twapId so distinct slice fills do not collide', () => {
    const response = [
      { fill: fakeFill({ tid: 42 }), twapId: 7 },
      { fill: fakeFill({ tid: 42 }), twapId: 9 },
    ] as unknown as UserTwapSliceFillsByTimeResponse
    const out = projectTwapSliceFills(response)
    expect(out[0]!.identifier).not.toBe(out[1]!.identifier)
  })
})

describe('createHyperliquidTwapSliceFillsReader', () => {
  it('fetches via getUserTwapSliceFills and emits projected fills to subscribers', async () => {
    const calls: WalletAddress[] = []
    const gateway = {
      getUserTwapSliceFills: (address: WalletAddress) => {
        calls.push(address)
        return okAsync([{ fill: fakeFill(), twapId: 7 }] as unknown as UserTwapSliceFillsByTimeResponse)
      },
    } as unknown as HyperliquidGateway
    const reader = createHyperliquidTwapSliceFillsReader(gateway, () => ADDRESS, buildFakeLogger().logger)

    const seen: ReadonlyArray<unknown>[] = []
    reader.subscribe((fills) => seen.push(fills))
    const result = await reader.loadOlder()
    expect(result.isOk()).toBe(true)
    expect(calls).toHaveLength(1)
    // last emission carries the projected fill
    const last = seen[seen.length - 1]!
    expect(last).toHaveLength(1)
  })

  it('returns exhausted true with no fetch when there is no address', async () => {
    let fetched = false
    const gateway = {
      getUserTwapSliceFills: () => {
        fetched = true
        return okAsync([] as unknown as UserTwapSliceFillsByTimeResponse)
      },
    } as unknown as HyperliquidGateway
    const reader = createHyperliquidTwapSliceFillsReader(gateway, () => null, buildFakeLogger().logger)
    const result = await reader.loadOlder()
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.exhausted).toBe(true)
    expect(fetched).toBe(false)
  })
})
