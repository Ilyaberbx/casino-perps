import type {
  ActiveStakingDiscount,
  FeeSchedule,
  FeeScheduleReader,
  MakerRebateTierRow,
  StakingDiscountTierRow,
  Unsubscribe,
  VolumeTierRow,
} from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { UserFeesResponse } from '../gateway/sdk-types'
import type { HyperliquidPullService } from './hyperliquid-pull'
import { parseStringifiedNumber } from '../hyperliquid.utils'

const RATE_TO_BPS = 10_000

/**
 * Projects the fee schedule from the shared 30s pull snapshot's `userFees`
 * payload — no per-tick `getUserFees` of its own (ADR-0022). `currentTierKey`
 * is read from the pull's resolved tier, the rest from the raw payload.
 */
export function createHyperliquidFeeScheduleReader(
  pull: HyperliquidPullService,
  logger: Logger,
): FeeScheduleReader {
  const log = logger.child({ module: 'hyperliquid-fees-reader' })
  log.debug({}, 'init')
  const listeners = new Set<(schedule: FeeSchedule) => void>()

  function buildFromSnapshot(): FeeSchedule | null {
    const snapshot = pull.current()
    if (snapshot.userFees === null) return null
    return buildSchedule(snapshot.userFees, snapshot.currentTier?.key ?? null)
  }

  function notify(): void {
    const schedule = buildFromSnapshot()
    if (schedule === null) return
    log.debug(
      { currentTierKey: schedule.currentTierKey, tierCount: schedule.tiers.length },
      'projection',
    )
    for (const listener of listeners) listener(schedule)
  }

  pull.subscribe(() => notify())

  return {
    subscribe(onUpdate: (schedule: FeeSchedule) => void): Unsubscribe {
      listeners.add(onUpdate)
      const schedule = buildFromSnapshot()
      if (schedule !== null) onUpdate(schedule)
      return () => {
        listeners.delete(onUpdate)
      }
    },
  }
}

function buildSchedule(payload: UserFeesResponse, currentTierKey: string | null): FeeSchedule {
  const userPerpsTakerRate = parseStringifiedNumber(payload.userCrossRate)
  const userPerpsMakerRate = parseStringifiedNumber(payload.userAddRate)
  const userSpotTakerRate = parseStringifiedNumber(payload.userSpotCrossRate)
  const userSpotMakerRate = parseStringifiedNumber(payload.userSpotAddRate)
  return {
    tiers: [
      {
        key: 'perps',
        label: 'Perps',
        takerBps: userPerpsTakerRate * RATE_TO_BPS,
        makerBps: userPerpsMakerRate * RATE_TO_BPS,
      },
      {
        key: 'spot',
        label: 'Spot',
        takerBps: userSpotTakerRate * RATE_TO_BPS,
        makerBps: userSpotMakerRate * RATE_TO_BPS,
      },
    ],
    currentTierKey,
    volumeTiers: projectVolumeTiers(payload),
    makerRebateTiers: projectMakerRebateTiers(payload),
    stakingDiscountTiers: projectStakingDiscountTiers(payload),
    referralDiscount: parseStringifiedNumber(payload.feeSchedule.referralDiscount),
    activeReferralDiscount: parseStringifiedNumber(payload.activeReferralDiscount),
    activeStakingDiscount: projectActiveStakingDiscount(payload),
    userPerpsTakerRate,
    userPerpsMakerRate,
    userSpotTakerRate,
    userSpotMakerRate,
  }
}

function projectVolumeTiers(payload: UserFeesResponse): ReadonlyArray<VolumeTierRow> {
  const vip = payload.feeSchedule.tiers.vip
  const firstCutoff = vip.length > 0 && vip[0] !== undefined
    ? parseStringifiedNumber(vip[0].ntlCutoff)
    : 0
  const tier0: VolumeTierRow = {
    key: 'tier-0',
    label: '0',
    notionalCutoff: firstCutoff,
    perpsTaker: parseStringifiedNumber(payload.feeSchedule.cross),
    perpsMaker: parseStringifiedNumber(payload.feeSchedule.add),
    spotTaker: parseStringifiedNumber(payload.feeSchedule.spotCross),
    spotMaker: parseStringifiedNumber(payload.feeSchedule.spotAdd),
  }
  const vipRows: VolumeTierRow[] = vip.map((row, i) => ({
    key: `tier-${i + 1}`,
    label: String(i + 1),
    notionalCutoff: parseStringifiedNumber(row.ntlCutoff),
    perpsTaker: parseStringifiedNumber(row.cross),
    perpsMaker: parseStringifiedNumber(row.add),
    spotTaker: parseStringifiedNumber(row.spotCross),
    spotMaker: parseStringifiedNumber(row.spotAdd),
  }))
  return [tier0, ...vipRows]
}

function projectMakerRebateTiers(payload: UserFeesResponse): ReadonlyArray<MakerRebateTierRow> {
  return payload.feeSchedule.tiers.mm.map((row) => ({
    makerFractionCutoff: parseStringifiedNumber(row.makerFractionCutoff),
    addRate: parseStringifiedNumber(row.add),
  }))
}

function projectStakingDiscountTiers(payload: UserFeesResponse): ReadonlyArray<StakingDiscountTierRow> {
  return payload.feeSchedule.stakingDiscountTiers.map((row) => ({
    bpsOfMaxSupply: parseStringifiedNumber(row.bpsOfMaxSupply),
    discount: parseStringifiedNumber(row.discount),
  }))
}

function projectActiveStakingDiscount(payload: UserFeesResponse): ActiveStakingDiscount {
  return {
    bpsOfMaxSupply: parseStringifiedNumber(payload.activeStakingDiscount.bpsOfMaxSupply),
    discount: parseStringifiedNumber(payload.activeStakingDiscount.discount),
  }
}
