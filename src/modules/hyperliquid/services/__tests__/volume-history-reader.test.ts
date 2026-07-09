import { describe, it, expect } from 'vitest'
import type { VolumeHistory } from '@/modules/shared/domain'
import { createHyperliquidVolumeHistoryReader } from '../volume-history-reader'
import type { UserFeesResponse } from '../../gateway/sdk-types'
import {
  buildFakeLogger,
  buildFakePullService,
  buildUserFees,
} from '../__fixtures__/web-data2'

function withDailyVlm(rows: ReadonlyArray<{ date: string; userCross: string; userAdd: string; exchange: string }>): UserFeesResponse {
  const base = buildUserFees()
  return { ...base, dailyUserVlm: rows } as UserFeesResponse
}

describe('createHyperliquidVolumeHistoryReader', () => {
  it('emits an empty history when dailyUserVlm is empty', () => {
    const pull = buildFakePullService({ userFees: withDailyVlm([]) })
    const reader = createHyperliquidVolumeHistoryReader(pull, buildFakeLogger().logger)
    const seen: VolumeHistory[] = []
    reader.subscribe((h) => seen.push(h))
    expect(seen.length).toBeGreaterThan(0)
    expect(seen[seen.length - 1].entries).toEqual([])
  })

  it('projects a single day of dailyUserVlm to a VolumeHistoryEntry', () => {
    const pull = buildFakePullService({
      userFees: withDailyVlm([{ date: '2026-05-10', userCross: '1500.5', userAdd: '300.25', exchange: '1000000' }]),
    })
    const reader = createHyperliquidVolumeHistoryReader(pull, buildFakeLogger().logger)
    const seen: VolumeHistory[] = []
    reader.subscribe((h) => seen.push(h))
    const last = seen[seen.length - 1]
    expect(last.entries).toHaveLength(1)
    expect(last.entries[0]).toEqual({
      date: '2026-05-10',
      exchangeVolume: 1_000_000,
      userMakerVolume: 300.25,
      userTakerVolume: 1500.5,
    })
  })

  it('projects multiple days preserving SDK order', () => {
    const pull = buildFakePullService({
      userFees: withDailyVlm([
        { date: '2026-05-08', userCross: '100', userAdd: '50', exchange: '900000' },
        { date: '2026-05-09', userCross: '200', userAdd: '0', exchange: '950000' },
        { date: '2026-05-10', userCross: '0', userAdd: '500', exchange: '1000000' },
      ]),
    })
    const reader = createHyperliquidVolumeHistoryReader(pull, buildFakeLogger().logger)
    const seen: VolumeHistory[] = []
    reader.subscribe((h) => seen.push(h))
    const last = seen[seen.length - 1]
    expect(last.entries.map((e) => e.date)).toEqual(['2026-05-08', '2026-05-09', '2026-05-10'])
    expect(last.entries[1]).toEqual({
      date: '2026-05-09',
      exchangeVolume: 950_000,
      userMakerVolume: 0,
      userTakerVolume: 200,
    })
  })

  it('does not emit when the pull snapshot has no userFees yet', () => {
    const pull = buildFakePullService() // userFees: null
    const reader = createHyperliquidVolumeHistoryReader(pull, buildFakeLogger().logger)
    const seen: unknown[] = []
    reader.subscribe((h) => seen.push(h))
    expect(seen).toHaveLength(0)
  })

  it('emits a debug projection record per update tagged module=hyperliquid-volume-history-reader', () => {
    const fakeLogger = buildFakeLogger()
    const pull = buildFakePullService({
      userFees: withDailyVlm([{ date: '2026-05-10', userCross: '1', userAdd: '0', exchange: '0' }]),
    })
    createHyperliquidVolumeHistoryReader(pull, fakeLogger.logger)
    const projections = fakeLogger.records.filter(
      (r) => r.level === 'debug' && r.message === 'projection',
    )
    expect(projections.length).toBeGreaterThanOrEqual(1)
    expect(projections[0].fields.module).toBe('hyperliquid-volume-history-reader')
    expect(projections[0].fields).toHaveProperty('entryCount')
  })
})
