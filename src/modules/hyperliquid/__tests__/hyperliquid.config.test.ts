import { describe, it, expect } from 'vitest'
import { loadHyperliquidConfig } from '../hyperliquid.config'

describe('loadHyperliquidConfig', () => {
  it('returns err(missing-network) when env var is absent', () => {
    const result = loadHyperliquidConfig({})
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('missing-network')
  })

  it('returns err(missing-network) when env var is empty string', () => {
    const result = loadHyperliquidConfig({ VITE_HYPERLIQUID_NETWORK: '' })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('missing-network')
  })

  it('returns err(invalid-network) for unknown network', () => {
    const result = loadHyperliquidConfig({ VITE_HYPERLIQUID_NETWORK: 'devnet' })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('invalid-network')
  })

  it('returns mainnet defaults when VITE_HYPERLIQUID_NETWORK=mainnet', () => {
    const result = loadHyperliquidConfig({ VITE_HYPERLIQUID_NETWORK: 'mainnet' })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.network).toBe('mainnet')
      expect(result.value.apiHttpUrl).toBe('https://api.hyperliquid.xyz')
      expect(result.value.apiWsUrl).toBe('wss://api.hyperliquid.xyz/ws')
    }
  })

  it('returns testnet defaults when VITE_HYPERLIQUID_NETWORK=testnet', () => {
    const result = loadHyperliquidConfig({ VITE_HYPERLIQUID_NETWORK: 'testnet' })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.network).toBe('testnet')
      expect(result.value.apiHttpUrl).toBe('https://api.hyperliquid-testnet.xyz')
      expect(result.value.apiWsUrl).toBe('wss://api.hyperliquid-testnet.xyz/ws')
    }
  })

  it('honours VITE_HYPERLIQUID_API_URL override and derives ws scheme', () => {
    const result = loadHyperliquidConfig({
      VITE_HYPERLIQUID_NETWORK: 'mainnet',
      VITE_HYPERLIQUID_API_URL: 'https://custom.example.com',
    })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.apiHttpUrl).toBe('https://custom.example.com')
      expect(result.value.apiWsUrl).toBe('wss://custom.example.com/ws')
    }
  })

  it('returns err(invalid-url) for non-http override', () => {
    const result = loadHyperliquidConfig({
      VITE_HYPERLIQUID_NETWORK: 'mainnet',
      VITE_HYPERLIQUID_API_URL: 'not-a-url',
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('invalid-url')
  })
})
