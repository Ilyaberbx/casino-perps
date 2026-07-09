import { describe, expect, it } from 'vitest'
import type { Balance, WalletAddress } from '@/modules/shared/domain'
import type { SpotMetaResponse } from '../../../gateway/sdk-types'
import {
  buildSendableTokens,
  buildSpotSendTokenIndex,
  mapGatewayErrorToSendError,
  percentOfAvailable,
  resolveSelectedToken,
  validateSendAmount,
  validateSendDestination,
} from '../send-flow.utils'
import { buildFakeFlowLogger, HYPE_TOKEN, USDC_TOKEN } from '../__fixtures__/fake-send-flow-deps'

const MASTER = '0x1111111111111111111111111111111111111111' as WalletAddress

function token(
  name: string,
  index: number,
  tokenId: `0x${string}`,
  weiDecimals = 8,
): SpotMetaResponse['tokens'][number] {
  return {
    name,
    szDecimals: 2,
    weiDecimals,
    index,
    tokenId,
    isCanonical: true,
    evmContract: null,
    fullName: name,
    deployerTradingFeeShare: '0',
  }
}

const META: SpotMetaResponse = {
  universe: [],
  tokens: [
    token('USDC', 0, '0x6d1e7cde53ba9467b783cb7c530ce054'),
    token('HYPE', 150, '0x0d01dc56dcaaca66ad901c959b4011ec'),
    token('UBTC', 197, '0x8f254b963e8468305d409b33aa137c67'),
  ],
}

function balance(asset: string, available: number, source: Balance['source'] = 'spot'): Balance {
  return { asset, amount: available, available, amountUsd: available, pnlPct: null, source }
}

const USDC_SPOT_ID = 'USDC:0x6d1e7cde53ba9467b783cb7c530ce054'

describe('buildSpotSendTokenIndex', () => {
  it('keys by canonical symbol, formats NAME:0xTOKENID, and indexes USDC', () => {
    const index = buildSpotSendTokenIndex(META)
    expect(index.get('HYPE')?.tokenId).toBe('HYPE:0x0d01dc56dcaaca66ad901c959b4011ec')
    // UBTC canonicalizes to BTC; the raw name is kept in the id.
    expect(index.get('BTC')?.tokenId).toBe('UBTC:0x8f254b963e8468305d409b33aa137c67')
    // USDC is indexed now — its id feeds the unified-account spotSend route.
    expect(index.get('USDC')?.tokenId).toBe(USDC_SPOT_ID)
  })
})

describe('buildSendableTokens', () => {
  it('segregated: offers USDC first, routed via usd, with the perp available', () => {
    const { logger } = buildFakeFlowLogger()
    const tokens = buildSendableTokens(true, 80, [], new Map(), logger)
    expect(tokens[0]).toMatchObject({ kind: 'usd', symbol: 'USDC', available: 80 })
  })

  // A UNIFIED account's USDC lives in the spot clearinghouse (the 'all'-scope
  // `source:'unified'` row), so it must route via spotSend — NOT usdSend against
  // the phantom-0 perp side. Reading the perp cap (0) stranded the user at $0.
  // This is the exact bug.
  it('unified: routes USDC via spotSend with the all-scope unified available', () => {
    const { logger } = buildFakeFlowLogger()
    const index = buildSpotSendTokenIndex(META)
    const tokens = buildSendableTokens(false, 0, [balance('USDC', 11.25, 'unified')], index, logger)
    expect(tokens[0]).toMatchObject({ kind: 'spot', symbol: 'USDC', available: 11.25 })
    if (tokens[0]?.kind === 'spot') expect(tokens[0].tokenId).toBe(USDC_SPOT_ID)
  })

  it('unified: omits USDC + logs a debug line when its id cannot be resolved yet', () => {
    const { logger, records } = buildFakeFlowLogger()
    const tokens = buildSendableTokens(false, 0, [balance('USDC', 11.25, 'unified')], new Map(), logger)
    expect(tokens.find((t) => t.symbol === 'USDC')).toBeUndefined()
    expect(records.some((r) => r.level === 'debug' && r.fields.symbol === 'USDC')).toBe(true)
  })

  it('includes a held spot token whose id resolves', () => {
    const { logger } = buildFakeFlowLogger()
    const index = buildSpotSendTokenIndex(META)
    const tokens = buildSendableTokens(true, 80, [balance('HYPE', 50)], index, logger)
    const hype = tokens.find((t) => t.symbol === 'HYPE')
    expect(hype).toMatchObject({ kind: 'spot', available: 50 })
    if (hype?.kind === 'spot') {
      expect(hype.tokenId).toBe('HYPE:0x0d01dc56dcaaca66ad901c959b4011ec')
    }
  })

  it('excludes a held spot token whose id cannot be resolved + logs a debug line', () => {
    const { logger, records } = buildFakeFlowLogger()
    const tokens = buildSendableTokens(true, 80, [balance('MYSTERY', 5)], new Map(), logger)
    expect(tokens.find((t) => t.symbol === 'MYSTERY')).toBeUndefined()
    expect(records.some((r) => r.level === 'debug' && r.fields.symbol === 'MYSTERY')).toBe(true)
  })

  it('skips zero-balance and USDC spot rows (USDC comes from the mode-aware slot)', () => {
    const { logger } = buildFakeFlowLogger()
    const index = buildSpotSendTokenIndex(META)
    const tokens = buildSendableTokens(
      true,
      80,
      [balance('HYPE', 0), balance('USDC', 12)],
      index,
      logger,
    )
    expect(tokens).toHaveLength(1)
    expect(tokens[0]?.symbol).toBe('USDC')
  })
})

describe('resolveSelectedToken', () => {
  it('returns the exact token by key', () => {
    expect(resolveSelectedToken([USDC_TOKEN, HYPE_TOKEN], 'spot:HYPE')).toBe(HYPE_TOKEN)
  })

  it('falls back to the first token when the key drifts', () => {
    expect(resolveSelectedToken([USDC_TOKEN, HYPE_TOKEN], 'spot:GONE')).toBe(USDC_TOKEN)
  })

  it('returns null on an empty list', () => {
    expect(resolveSelectedToken([], 'usd')).toBeNull()
  })
})

describe('validateSendAmount', () => {
  it('rejects empty / non-numeric / non-positive', () => {
    expect(validateSendAmount('', 100, 6).isValid).toBe(false)
    expect(validateSendAmount('abc', 100, 6).isValid).toBe(false)
    expect(validateSendAmount('0', 100, 6).isValid).toBe(false)
    expect(validateSendAmount('-5', 100, 6).isValid).toBe(false)
  })

  it('rejects more than the token decimals', () => {
    expect(validateSendAmount('5.1234567', 100, 6).isValid).toBe(false)
    expect(validateSendAmount('5.123456', 100, 6).isValid).toBe(true)
  })

  it('rejects an amount above the available cap', () => {
    expect(validateSendAmount('101', 100, 6).isValid).toBe(false)
  })

  it('accepts an exact-cap amount and returns the parsed value', () => {
    const r = validateSendAmount('100', 100, 6)
    expect(r.isValid).toBe(true)
    if (r.isValid) expect(r.value).toBe(100)
  })
})

describe('validateSendDestination', () => {
  it('rejects a malformed address', () => {
    const r = validateSendDestination('0x123', MASTER)
    expect(r.isValid).toBe(false)
    if (!r.isValid) expect(r.reason).toBe('destination-invalid')
  })

  it('rejects the user own master address (self-send), case-insensitively', () => {
    const r = validateSendDestination(MASTER.toUpperCase().replace('0X', '0x'), MASTER)
    expect(r.isValid).toBe(false)
    if (!r.isValid) expect(r.reason).toBe('self-send')
  })

  it('accepts a well-formed distinct address', () => {
    expect(validateSendDestination('0x2222222222222222222222222222222222222222', MASTER).isValid).toBe(
      true,
    )
  })
})

describe('percentOfAvailable', () => {
  it('computes each chip clamped to the token decimals', () => {
    expect(percentOfAvailable(25, 100, 6)).toBe('25')
    expect(percentOfAvailable(50, 73.5, 6)).toBe('36.75')
    expect(percentOfAvailable(25, 1, 8)).toBe('0.25')
  })

  it('returns empty when nothing is available', () => {
    expect(percentOfAvailable(50, 0, 6)).toBe('')
  })
})

describe('mapGatewayErrorToSendError', () => {
  it('maps the direct kinds 1:1', () => {
    expect(mapGatewayErrorToSendError('wallet-rejected')).toBe('wallet-rejected')
    expect(mapGatewayErrorToSendError('rate-limited')).toBe('rate-limited')
    expect(mapGatewayErrorToSendError('network')).toBe('network')
  })

  it('collapses the remaining kinds to unknown', () => {
    expect(mapGatewayErrorToSendError('invalid-response')).toBe('unknown')
    expect(mapGatewayErrorToSendError('chain-mismatch')).toBe('unknown')
  })
})
