import { describe, expect, it } from 'vitest'
import { resolveHyperEvmRpcUrl } from '../hyperevm.config'

describe('resolveHyperEvmRpcUrl', () => {
  it('falls back to undefined when unset or empty', () => {
    expect(resolveHyperEvmRpcUrl({})).toEqual({ url: undefined, invalidRaw: null })
    expect(resolveHyperEvmRpcUrl({ VITE_HYPEREVM_RPC_URL: '' })).toEqual({
      url: undefined,
      invalidRaw: null,
    })
  })

  it('accepts a valid http(s) override', () => {
    expect(resolveHyperEvmRpcUrl({ VITE_HYPEREVM_RPC_URL: 'https://my.rpc/evm' })).toEqual({
      url: 'https://my.rpc/evm',
      invalidRaw: null,
    })
  })

  it('rejects a non-http(s) override and surfaces the raw value', () => {
    expect(resolveHyperEvmRpcUrl({ VITE_HYPEREVM_RPC_URL: 'wss://nope' })).toEqual({
      url: undefined,
      invalidRaw: 'wss://nope',
    })
  })
})
