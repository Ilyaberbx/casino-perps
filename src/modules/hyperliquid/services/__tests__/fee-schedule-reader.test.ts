import { describe, it, expect } from 'vitest'
import type { FeeSchedule } from '@/modules/shared/domain'
import { createHyperliquidFeeScheduleReader } from '../fee-schedule-reader'
import type { UserFeesResponse } from '../../gateway/sdk-types'
import {
  buildFakeLogger,
  buildFakePullService,
  buildUserFees,
} from '../__fixtures__/web-data2'

describe('createHyperliquidFeeScheduleReader', () => {
  it('projects the fee schedule from the pull snapshot userFees payload', () => {
    const pull = buildFakePullService({
      userFees: buildUserFees({
        userCrossRate: '0.00045',
        userAddRate: '0',
        userSpotCrossRate: '0.00045',
        userSpotAddRate: '0',
      }),
    })
    const reader = createHyperliquidFeeScheduleReader(pull, buildFakeLogger().logger)
    const seen: FeeSchedule[] = []
    reader.subscribe((schedule) => seen.push(schedule))
    expect(seen.length).toBeGreaterThan(0)
    const schedule = seen[seen.length - 1]
    expect(schedule.tiers.find((t) => t.key === 'perps')?.takerBps).toBeCloseTo(4.5, 4)
    expect(schedule.tiers.find((t) => t.key === 'perps')?.makerBps).toBeCloseTo(0, 4)
    expect(schedule.tiers.find((t) => t.key === 'spot')?.takerBps).toBeCloseTo(4.5, 4)
    expect(schedule.tiers.find((t) => t.key === 'spot')?.makerBps).toBeCloseTo(0, 4)
  })

  it('currentTierKey reflects the pull-cache resolved tier', () => {
    const pull = buildFakePullService({
      userFees: buildUserFees(),
      currentTier: { key: 'vip-2', label: 'VIP 2' },
    })
    const reader = createHyperliquidFeeScheduleReader(pull, buildFakeLogger().logger)
    const seen: FeeSchedule[] = []
    reader.subscribe((s) => seen.push(s))
    expect(seen[seen.length - 1].currentTierKey).toBe('vip-2')
  })

  it('does not emit when the pull snapshot has no userFees yet', () => {
    const pull = buildFakePullService() // userFees: null
    const reader = createHyperliquidFeeScheduleReader(pull, buildFakeLogger().logger)
    const seen: unknown[] = []
    reader.subscribe((s) => seen.push(s))
    expect(seen).toHaveLength(0)
  })

  it('emits a debug projection record per update with module + tierCount', () => {
    const fakeLogger = buildFakeLogger()
    const pull = buildFakePullService({ userFees: buildUserFees() })
    createHyperliquidFeeScheduleReader(pull, fakeLogger.logger)
    const projections = fakeLogger.records.filter(
      (r) => r.level === 'debug' && r.message === 'projection',
    )
    expect(projections.length).toBeGreaterThanOrEqual(1)
    expect(projections[0].fields.module).toBe('hyperliquid-fees-reader')
    expect(projections[0].fields).toHaveProperty('tierCount')
  })

  it('projects vip volume tiers from feeSchedule.tiers.vip', () => {
    const pull = buildFakePullService({
      userFees: {
        ...buildUserFees(),
        feeSchedule: {
          cross: '0.00045',
          add: '0.00015',
          spotCross: '0.0007',
          spotAdd: '0.0004',
          tiers: {
            vip: [
              { ntlCutoff: '5000000', cross: '0.0004', add: '0.00012', spotCross: '0.0006', spotAdd: '0.0003' },
              { ntlCutoff: '25000000', cross: '0.00035', add: '0.0001', spotCross: '0.0005', spotAdd: '0.0002' },
            ],
            mm: [],
          },
          referralDiscount: '0.04',
          stakingDiscountTiers: [],
        },
      } as UserFeesResponse,
    })
    const reader = createHyperliquidFeeScheduleReader(pull, buildFakeLogger().logger)
    const seen: FeeSchedule[] = []
    reader.subscribe((s) => seen.push(s))
    const last = seen[seen.length - 1]
    expect(last.volumeTiers).toHaveLength(3)
    expect(last.volumeTiers[0]).toEqual({
      key: 'tier-0',
      label: '0',
      notionalCutoff: 5_000_000,
      perpsTaker: 0.00045,
      perpsMaker: 0.00015,
      spotTaker: 0.0007,
      spotMaker: 0.0004,
    })
    expect(last.volumeTiers[1]).toEqual({
      key: 'tier-1',
      label: '1',
      notionalCutoff: 5_000_000,
      perpsTaker: 0.0004,
      perpsMaker: 0.00012,
      spotTaker: 0.0006,
      spotMaker: 0.0003,
    })
    expect(last.volumeTiers[2].notionalCutoff).toBe(25_000_000)
  })

  it('projects maker rebate tiers and staking discount tiers', () => {
    const pull = buildFakePullService({
      userFees: {
        ...buildUserFees(),
        feeSchedule: {
          cross: '0',
          add: '0',
          spotCross: '0',
          spotAdd: '0',
          tiers: {
            vip: [],
            mm: [
              { makerFractionCutoff: '0.005', add: '-0.00001' },
              { makerFractionCutoff: '0.015', add: '-0.00003' },
            ],
          },
          referralDiscount: '0.04',
          stakingDiscountTiers: [
            { bpsOfMaxSupply: '1', discount: '0.05' },
            { bpsOfMaxSupply: '5', discount: '0.1' },
          ],
        },
      } as UserFeesResponse,
    })
    const reader = createHyperliquidFeeScheduleReader(pull, buildFakeLogger().logger)
    const seen: FeeSchedule[] = []
    reader.subscribe((s) => seen.push(s))
    const last = seen[seen.length - 1]
    expect(last.makerRebateTiers).toEqual([
      { makerFractionCutoff: 0.005, addRate: -0.00001 },
      { makerFractionCutoff: 0.015, addRate: -0.00003 },
    ])
    expect(last.stakingDiscountTiers).toEqual([
      { bpsOfMaxSupply: 1, discount: 0.05 },
      { bpsOfMaxSupply: 5, discount: 0.1 },
    ])
  })

  it('exposes active referral discount and active staking discount', () => {
    const pull = buildFakePullService({
      userFees: {
        ...buildUserFees(),
        activeReferralDiscount: '0.04',
        activeStakingDiscount: { bpsOfMaxSupply: '2.5', discount: '0.1' },
        feeSchedule: {
          cross: '0',
          add: '0',
          spotCross: '0',
          spotAdd: '0',
          tiers: { vip: [], mm: [] },
          referralDiscount: '0.04',
          stakingDiscountTiers: [],
        },
      } as UserFeesResponse,
    })
    const reader = createHyperliquidFeeScheduleReader(pull, buildFakeLogger().logger)
    const seen: FeeSchedule[] = []
    reader.subscribe((s) => seen.push(s))
    const last = seen[seen.length - 1]
    expect(last.referralDiscount).toBe(0.04)
    expect(last.activeReferralDiscount).toBe(0.04)
    expect(last.activeStakingDiscount).toEqual({ bpsOfMaxSupply: 2.5, discount: 0.1 })
  })

  it('exposes user perps/spot taker and maker rates as raw fractions', () => {
    const pull = buildFakePullService({
      userFees: buildUserFees({
        userCrossRate: '0.00045',
        userAddRate: '0.00015',
        userSpotCrossRate: '0.0007',
        userSpotAddRate: '0.0004',
      }),
    })
    const reader = createHyperliquidFeeScheduleReader(pull, buildFakeLogger().logger)
    const seen: FeeSchedule[] = []
    reader.subscribe((s) => seen.push(s))
    const last = seen[seen.length - 1]
    expect(last.userPerpsTakerRate).toBeCloseTo(0.00045, 6)
    expect(last.userPerpsMakerRate).toBeCloseTo(0.00015, 6)
    expect(last.userSpotTakerRate).toBeCloseTo(0.0007, 6)
    expect(last.userSpotMakerRate).toBeCloseTo(0.0004, 6)
  })

  it('refreshes the fee schedule when the pull snapshot pushes a new payload', () => {
    const pull = buildFakePullService({ userFees: buildUserFees({ userCrossRate: '0.0001' }) })
    const reader = createHyperliquidFeeScheduleReader(pull, buildFakeLogger().logger)
    const takerValues: number[] = []
    reader.subscribe((s) => {
      const t = s.tiers.find((tier) => tier.key === 'perps')
      if (t) takerValues.push(t.takerBps)
    })
    pull.setSnapshot({ userFees: buildUserFees({ userCrossRate: '0.0002' }) })
    expect(takerValues.length).toBeGreaterThanOrEqual(2)
    expect(takerValues[0]).toBeCloseTo(1, 4)
    expect(takerValues[takerValues.length - 1]).toBeCloseTo(2, 4)
  })
})
