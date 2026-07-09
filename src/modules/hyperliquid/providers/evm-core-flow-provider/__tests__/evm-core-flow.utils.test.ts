import { describe, expect, it } from 'vitest'
import type { Balance } from '@/modules/shared/domain'
import type { SpotMetaResponse } from '../../../gateway/sdk-types'
import {
  buildEvmCoreTokenIndex,
  buildEvmCoreTokens,
  buildEvmCoreTokensFromIndex,
  evmDecimalsForToken,
  mapEvmServiceErrorToReason,
  mapGatewayErrorToEvmCoreError,
  percentOfAvailable,
  resolveSelectedToken,
  systemAddressForToken,
  toEvmRawAmount,
  toSystemAddress,
  validateEvmCoreAmount,
} from '../evm-core-flow.utils'
import { HYPE_SYSTEM_ADDRESS } from '../evm-core-flow.constants'
import { buildFakeFlowLogger, HYPE_TOKEN, UBTC_TOKEN } from '../__fixtures__/fake-evm-core-flow-deps'

function token(
  name: string,
  index: number,
  tokenId: `0x${string}`,
  evmContract: SpotMetaResponse['tokens'][number]['evmContract'],
  weiDecimals = 8,
): SpotMetaResponse['tokens'][number] {
  return {
    name,
    szDecimals: 2,
    weiDecimals,
    index,
    tokenId,
    isCanonical: true,
    evmContract,
    fullName: name,
    deployerTradingFeeShare: '0',
  }
}

const EVM_CONTRACT = {
  address: '0x8f254b963e8468305d409b33aa137c67aabbccdd' as `0x${string}`,
  evm_extra_wei_decimals: 2,
}

const META: SpotMetaResponse = {
  universe: [],
  tokens: [
    // EVM-linked standard token (Unit-bridged → canonicalizes to BTC)
    token('UBTC', 197, '0x8f254b963e8468305d409b33aa137c67', EVM_CONTRACT),
    // HYPE: native gas token, no evmContract — still movable (special address)
    token('HYPE', 150, '0x0d01dc56dcaaca66ad901c959b4011ec', null),
    // A token with NO evmContract and not HYPE → excluded (not EVM-linked)
    token('PURR', 1, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', null),
  ],
}

function balance(asset: string, available: number): Balance {
  return { asset, amount: available, available, amountUsd: available, pnlPct: null, source: 'spot' }
}

describe('toSystemAddress', () => {
  it('derives 0x20… + index in the low bytes', () => {
    expect(toSystemAddress(200)).toBe('0x20000000000000000000000000000000000000c8')
    expect(toSystemAddress(197)).toBe('0x20000000000000000000000000000000000000c5')
    expect(toSystemAddress(0)).toBe('0x2000000000000000000000000000000000000000')
  })
})

describe('systemAddressForToken', () => {
  it('routes HYPE to the special 0x2222…2222 address', () => {
    expect(systemAddressForToken({ isHype: true, index: 150 })).toBe(HYPE_SYSTEM_ADDRESS)
  })

  it('routes a standard token to its index-derived address', () => {
    expect(systemAddressForToken({ isHype: false, index: 197 })).toBe(
      '0x20000000000000000000000000000000000000c5',
    )
  })
})

describe('buildEvmCoreTokenIndex', () => {
  it('includes EVM-linked tokens keyed by canonical symbol, with the raw NAME:0xTOKENID', () => {
    const index = buildEvmCoreTokenIndex(META)
    const btc = index.get('BTC')
    expect(btc?.tokenId).toBe('UBTC:0x8f254b963e8468305d409b33aa137c67')
    expect(btc?.index).toBe(197)
    expect(btc?.isHype).toBe(false)
    expect(btc?.evmAddress).toBe(EVM_CONTRACT.address)
    expect(btc?.evmExtraWeiDecimals).toBe(2)
  })

  it('includes HYPE even though its evmContract is null (native, special address)', () => {
    const index = buildEvmCoreTokenIndex(META)
    const hype = index.get('HYPE')
    expect(hype?.isHype).toBe(true)
    expect(hype?.evmAddress).toBeNull()
  })

  it('excludes a non-HYPE token with no evmContract (not EVM-linked)', () => {
    const index = buildEvmCoreTokenIndex(META)
    expect(index.has('PURR')).toBe(false)
  })
})

describe('buildEvmCoreTokens', () => {
  it('offers held tokens whose symbol resolves to an EVM-linked token', () => {
    const { logger } = buildFakeFlowLogger()
    const index = buildEvmCoreTokenIndex(META)
    const tokens = buildEvmCoreTokens([balance('BTC', 2), balance('HYPE', 50)], index, logger)
    expect(tokens.map((t) => t.symbol)).toEqual(['BTC', 'HYPE'])
    expect(tokens[0]?.tokenId).toBe('UBTC:0x8f254b963e8468305d409b33aa137c67')
  })

  it('excludes a held token that is not EVM-linked + logs a debug line', () => {
    const { logger, records } = buildFakeFlowLogger()
    const index = buildEvmCoreTokenIndex(META)
    const tokens = buildEvmCoreTokens([balance('PURR', 5)], index, logger)
    expect(tokens).toHaveLength(0)
    expect(records.some((r) => r.level === 'debug' && r.fields.symbol === 'PURR')).toBe(true)
  })

  it('skips zero-balance rows', () => {
    const { logger } = buildFakeFlowLogger()
    const index = buildEvmCoreTokenIndex(META)
    const tokens = buildEvmCoreTokens([balance('BTC', 0)], index, logger)
    expect(tokens).toHaveLength(0)
  })
})

describe('resolveSelectedToken', () => {
  it('returns the exact token by key', () => {
    expect(resolveSelectedToken([UBTC_TOKEN, HYPE_TOKEN], 'evm-core:HYPE')).toBe(HYPE_TOKEN)
  })

  it('falls back to the first token when the key drifts', () => {
    expect(resolveSelectedToken([UBTC_TOKEN, HYPE_TOKEN], 'evm-core:GONE')).toBe(UBTC_TOKEN)
  })

  it('returns null on an empty list', () => {
    expect(resolveSelectedToken([], 'evm-core:BTC')).toBeNull()
  })
})

describe('validateEvmCoreAmount', () => {
  it('rejects empty / non-numeric / non-positive', () => {
    expect(validateEvmCoreAmount('', 100, 6).isValid).toBe(false)
    expect(validateEvmCoreAmount('abc', 100, 6).isValid).toBe(false)
    expect(validateEvmCoreAmount('0', 100, 6).isValid).toBe(false)
    expect(validateEvmCoreAmount('-5', 100, 6).isValid).toBe(false)
  })

  it('rejects more than the token decimals + above the cap', () => {
    expect(validateEvmCoreAmount('5.1234567', 100, 6).isValid).toBe(false)
    expect(validateEvmCoreAmount('101', 100, 6).isValid).toBe(false)
  })

  it('accepts an exact-cap amount and returns the parsed value', () => {
    const r = validateEvmCoreAmount('100', 100, 6)
    expect(r.isValid).toBe(true)
    if (r.isValid) expect(r.value).toBe(100)
  })
})

describe('percentOfAvailable', () => {
  it('computes each chip clamped to the token decimals', () => {
    expect(percentOfAvailable(25, 100, 6)).toBe('25')
    expect(percentOfAvailable(50, 73.5, 6)).toBe('36.75')
  })

  it('returns empty when nothing is available', () => {
    expect(percentOfAvailable(50, 0, 6)).toBe('')
  })
})

describe('mapGatewayErrorToEvmCoreError', () => {
  it('maps the direct kinds 1:1 and collapses the rest to unknown', () => {
    expect(mapGatewayErrorToEvmCoreError('wallet-rejected')).toBe('wallet-rejected')
    expect(mapGatewayErrorToEvmCoreError('network')).toBe('network')
    expect(mapGatewayErrorToEvmCoreError('invalid-response')).toBe('unknown')
  })
})

describe('evmDecimalsForToken', () => {
  it('uses 18 for HYPE and weiDecimals + evm_extra for others', () => {
    expect(evmDecimalsForToken({ isHype: true, decimals: 8, evmExtraWeiDecimals: 10 })).toBe(18)
    expect(evmDecimalsForToken({ isHype: false, decimals: 8, evmExtraWeiDecimals: 2 })).toBe(10)
  })
})

describe('toEvmRawAmount', () => {
  it('scales to the smallest EVM unit, flooring sub-precision (never rounds up)', () => {
    expect(toEvmRawAmount(1, 8)).toBe(100000000n)
    expect(toEvmRawAmount(0.5, 18)).toBe(500000000000000000n)
    // 1.123456789 at 8 decimals floors to 1.12345678
    expect(toEvmRawAmount(1.123456789, 8)).toBe(112345678n)
  })
})

describe('buildEvmCoreTokensFromIndex', () => {
  it('lists every EVM-linked token (incl. HYPE) with available 0, sorted by symbol', () => {
    const tokens = buildEvmCoreTokensFromIndex(buildEvmCoreTokenIndex(META))
    expect(tokens.map((t) => t.symbol)).toEqual(['BTC', 'HYPE'])
    expect(tokens.every((t) => t.available === 0)).toBe(true)
  })
})

describe('mapEvmServiceErrorToReason', () => {
  it('maps the direct kinds 1:1 and collapses the rest to unknown', () => {
    expect(mapEvmServiceErrorToReason('wallet-rejected')).toBe('wallet-rejected')
    expect(mapEvmServiceErrorToReason('chain-switch-failed')).toBe('chain-switch-failed')
    expect(mapEvmServiceErrorToReason('transfer-failed')).toBe('transfer-failed')
    expect(mapEvmServiceErrorToReason('balance-read-failed')).toBe('unknown')
  })
})
