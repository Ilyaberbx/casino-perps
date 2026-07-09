import { describe, expect, it } from 'vitest'
import { resolveArbitrumRpcUrl } from '../hyperliquid-deposit.config'

describe('resolveArbitrumRpcUrl', () => {
  it('falls back to the default RPC (undefined) when unset', () => {
    expect(resolveArbitrumRpcUrl({})).toEqual({ url: undefined, invalidRaw: null })
  })

  it('treats an empty string as unset', () => {
    expect(resolveArbitrumRpcUrl({ VITE_ARBITRUM_RPC_URL: '' })).toEqual({
      url: undefined,
      invalidRaw: null,
    })
  })

  it('passes through a valid https override', () => {
    const url = 'https://arb-mainnet.g.alchemy.com/v2/key'
    expect(resolveArbitrumRpcUrl({ VITE_ARBITRUM_RPC_URL: url })).toEqual({
      url,
      invalidRaw: null,
    })
  })

  it('passes through a valid http override', () => {
    const url = 'http://localhost:8545'
    expect(resolveArbitrumRpcUrl({ VITE_ARBITRUM_RPC_URL: url })).toEqual({
      url,
      invalidRaw: null,
    })
  })

  it('rejects a non-url value and reports invalidRaw (no crash, default RPC)', () => {
    expect(resolveArbitrumRpcUrl({ VITE_ARBITRUM_RPC_URL: 'not a url' })).toEqual({
      url: undefined,
      invalidRaw: 'not a url',
    })
  })

  it('rejects a non-http(s) protocol (e.g. ws://) and reports invalidRaw', () => {
    expect(resolveArbitrumRpcUrl({ VITE_ARBITRUM_RPC_URL: 'ws://arb1.arbitrum.io' })).toEqual({
      url: undefined,
      invalidRaw: 'ws://arb1.arbitrum.io',
    })
  })
})
