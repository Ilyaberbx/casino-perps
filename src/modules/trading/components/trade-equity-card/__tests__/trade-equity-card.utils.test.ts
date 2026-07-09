import { describe, expect, it } from 'vitest'
import type { EquityExtensionBucket, MarginSummarySnapshot } from '@/modules/shared/domain'
import {
  buildEquityRows,
  buildLeverageBreakdown,
  filterSimpleEquityRows,
  formatLeverage,
  formatMarginRatio,
  marginRatioBand,
  nonZeroOrNull,
  signedTone,
} from '../trade-equity-card.utils'

const SEGREGATED_MARGIN: MarginSummarySnapshot = {
  maintenanceMarginUsd: 3.75,
  accountLeverage: 33.91,
  marginRatioPct: 42.37,
  unrealizedPnlUsd: 0.29,
  totalCrossPositionsValueUsd: 300.07,
  crossAccountValueUsd: 8.85,
}

const UNIFIED_MARGIN: MarginSummarySnapshot = {
  maintenanceMarginUsd: null,
  accountLeverage: null,
  marginRatioPct: 0,
  unrealizedPnlUsd: null,
  totalCrossPositionsValueUsd: null,
  crossAccountValueUsd: null,
}

// Unified account with an open HIP-3 position: Maintenance Margin / Leverage stay
// null (shown `--`), but Unrealized PnL is populated (the bug fix — sourced from
// the all-dexs positions the single-dex webData2 summary never sees).
const UNIFIED_MARGIN_WITH_PNL: MarginSummarySnapshot = {
  maintenanceMarginUsd: null,
  accountLeverage: null,
  marginRatioPct: 0,
  unrealizedPnlUsd: 0.5,
  totalCrossPositionsValueUsd: null,
  crossAccountValueUsd: null,
}

const BUCKETS: ReadonlyArray<EquityExtensionBucket> = [
  { key: 'vault', label: 'Vault Equity', amountUsd: 12.7 },
  { key: 'earn', label: 'Earn Balance', amountUsd: 0 },
]

describe('scalar helpers', () => {
  it('nonZeroOrNull maps zero/null to null, keeps non-zero', () => {
    expect(nonZeroOrNull(0)).toBeNull()
    expect(nonZeroOrNull(null)).toBeNull()
    expect(nonZeroOrNull(8.56)).toBe(8.56)
  })

  it('signedTone reflects the sign', () => {
    expect(signedTone(0.29)).toBe('up')
    expect(signedTone(-1.2)).toBe('down')
    expect(signedTone(0)).toBe('neutral')
    expect(signedTone(null)).toBe('neutral')
  })

  it('formats leverage and margin ratio', () => {
    expect(formatLeverage(33.91)).toBe('33.91x')
    expect(formatMarginRatio(42.37)).toBe('42.37%')
  })

  it('marginRatioBand: green < 50, amber 50-80, red >= 80', () => {
    expect(marginRatioBand(0)).toBe('safe')
    expect(marginRatioBand(42.37)).toBe('safe')
    expect(marginRatioBand(50)).toBe('caution')
    expect(marginRatioBand(79.9)).toBe('caution')
    expect(marginRatioBand(80)).toBe('danger')
    expect(marginRatioBand(95)).toBe('danger')
  })
})

describe('buildEquityRows', () => {
  it('segregated: Spot + Perps (ex-uPnL) and the derived sub-group from margin', () => {
    const rows = buildEquityRows({
      isSegregated: true,
      isConnected: true,
      spotEquity: 0,
      perpsEquity: 8.85,
      buckets: [],
      margin: SEGREGATED_MARGIN,
    })
    expect(rows.map((r) => r.label)).toEqual([
      'Spot',
      'Perps',
      'Unrealized PNL',
      'Maintenance Margin',
      'Cross Account Leverage',
    ])
    // Perps is shown ex-unrealized-PnL: 8.85 - 0.29 = 8.56 (ADR-0072).
    expect(rows.find((r) => r.key === 'perps')?.value).toBeCloseTo(8.56, 5)
    expect(rows.find((r) => r.key === 'unrealizedPnl')).toMatchObject({
      value: 0.29,
      format: 'signedUsd',
      tone: 'up',
      muted: true,
    })
    expect(rows.find((r) => r.key === 'maintenanceMargin')).toMatchObject({ value: 3.75, format: 'usd' })
    expect(rows.find((r) => r.key === 'accountLeverage')).toMatchObject({ value: 33.91, format: 'leverage' })
    // Dotted-underline tooltips on Perps + Maintenance Margin.
    expect(rows.find((r) => r.key === 'perps')?.tooltip).toContain('excluding open-position PnL')
    expect(rows.find((r) => r.key === 'maintenanceMargin')?.tooltip).toContain('keep your cross positions open')
  })

  it('unified: single Trading Equity = spot + perp equity (ex-uPnL); uPnL populated, MM/leverage dashed', () => {
    const rows = buildEquityRows({
      isSegregated: false,
      isConnected: true,
      // available spot 2 + all-dexs perp equity 3.5 (incl uPnL 0.5).
      spotEquity: 2,
      perpsEquity: 3.5,
      buckets: [],
      margin: UNIFIED_MARGIN_WITH_PNL,
    })
    expect(rows.map((r) => r.label)).toEqual([
      'Trading Equity',
      'Unrealized PNL',
      'Perps Maintenance Margin',
      'Unified Account Leverage',
    ])
    // Trading Equity = (2 + 3.5) − uPnL 0.5 = 5.0 (ex-uPnL, mirroring segregated Perps).
    expect(rows.find((r) => r.key === 'trading')?.value).toBeCloseTo(5.0, 5)
    // uPnL row is no longer suppressed for unified.
    expect(rows.find((r) => r.key === 'unrealizedPnl')).toMatchObject({ value: 0.5, format: 'signedUsd' })
    // Maintenance Margin / Account Leverage stay `--` (null) for unified.
    expect(rows.find((r) => r.key === 'maintenanceMargin')?.value).toBeNull()
    expect(rows.find((r) => r.key === 'accountLeverage')?.value).toBeNull()
  })

  it('buckets render their amount when connected and a dash (null) when disconnected', () => {
    const connected = buildEquityRows({
      isSegregated: false,
      isConnected: true,
      spotEquity: 5,
      perpsEquity: 0,
      buckets: BUCKETS,
      margin: UNIFIED_MARGIN,
    })
    expect(connected.find((r) => r.key === 'vault')?.value).toBe(12.7)
    expect(connected.find((r) => r.key === 'earn')?.value).toBeNull()

    const disconnected = buildEquityRows({
      isSegregated: false,
      isConnected: false,
      spotEquity: 5,
      perpsEquity: 0,
      buckets: BUCKETS,
      margin: null,
    })
    expect(disconnected.find((r) => r.key === 'vault')?.value).toBeNull()
  })
})

describe('filterSimpleEquityRows (#278)', () => {
  it('keeps Spot / Perps / Unrealized PNL and drops MM / leverage / buckets', () => {
    const rows = buildEquityRows({
      isSegregated: true,
      isConnected: true,
      spotEquity: 4,
      perpsEquity: 8.85,
      buckets: BUCKETS,
      margin: SEGREGATED_MARGIN,
    })
    const simple = filterSimpleEquityRows(rows)
    expect(simple.map((r) => r.key)).toEqual(['spot', 'perps', 'unrealizedPnl'])
    expect(simple.map((r) => r.key)).not.toContain('maintenanceMargin')
    expect(simple.map((r) => r.key)).not.toContain('accountLeverage')
    expect(simple.map((r) => r.key)).not.toContain('vault')
  })

  it('keeps the unified Trading Equity + Unrealized PNL rows', () => {
    const rows = buildEquityRows({
      isSegregated: false,
      isConnected: true,
      spotEquity: 2,
      perpsEquity: 3.5,
      buckets: BUCKETS,
      margin: UNIFIED_MARGIN_WITH_PNL,
    })
    const simple = filterSimpleEquityRows(rows)
    expect(simple.map((r) => r.key)).toEqual(['trading', 'unrealizedPnl'])
  })
})

describe('buildLeverageBreakdown', () => {
  it('segregated: cross-flavored labels with live (a)/(b)/leverage values', () => {
    const b = buildLeverageBreakdown(SEGREGATED_MARGIN, true)
    expect(b).toEqual({
      aLabel: 'Total Cross Positions Value',
      aValue: 300.07,
      bLabel: 'Cross Account Value',
      bValue: 8.85,
      resultLabel: 'Cross Account Leverage',
      resultValue: 33.91,
    })
  })

  it('unified: unified-flavored labels with null values (rendered as a dash)', () => {
    const b = buildLeverageBreakdown(UNIFIED_MARGIN, false)
    expect(b.resultLabel).toBe('Unified Account Leverage')
    expect(b.aValue).toBeNull()
    expect(b.bValue).toBeNull()
    expect(b.resultValue).toBeNull()
  })
})
