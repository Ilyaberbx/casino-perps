import { describe, it, expect } from 'vitest'
import { dedupeByIdentifier } from '../dedupe-by-identifier'

type Row = { identifier: string; label: string }

const row = (identifier: string, label: string): Row => ({ identifier, label })

describe('dedupeByIdentifier', () => {
  it('keeps the first occurrence of each identifier and drops later duplicates', () => {
    const out = dedupeByIdentifier([
      row('1', 'first'),
      row('2', 'b'),
      row('1', 'second'),
    ])
    expect(out.map((r) => r.identifier)).toEqual(['1', '2'])
    // First occurrence wins.
    expect(out.find((r) => r.identifier === '1')?.label).toBe('first')
  })

  it('preserves order of the unique items', () => {
    const out = dedupeByIdentifier([row('3', 'c'), row('1', 'a'), row('2', 'b')])
    expect(out.map((r) => r.identifier)).toEqual(['3', '1', '2'])
  })

  it('collapses both sides of a two-sided match sharing one tid to a single row', () => {
    const buy = row('tid-1', 'buy')
    const sellSideOfSameMatch = { ...buy, label: 'sell' }
    const out = dedupeByIdentifier([buy, sellSideOfSameMatch, row('tid-2', 'x')])
    expect(out.map((r) => r.identifier)).toEqual(['tid-1', 'tid-2'])
  })

  it('passes through an already-unique list unchanged', () => {
    const input = [row('1', 'a'), row('2', 'b')]
    expect(dedupeByIdentifier(input)).toEqual(input)
  })

  it('returns an empty array for empty input', () => {
    expect(dedupeByIdentifier([])).toEqual([])
  })
})
