import type { Venue, FeeSchedule } from '@/modules/shared/domain'

export const PERPS_SPOT_FEE_SCHEDULE: FeeSchedule = {
  currentTierKey: 'perps',
  tiers: [
    { key: 'perps', label: 'Perps', takerBps: 2.5, makerBps: 0.5 },
    { key: 'spot', label: 'Spot', takerBps: 3.0, makerBps: 1.0 },
  ],
  volumeTiers: [],
  makerRebateTiers: [],
  stakingDiscountTiers: [],
  referralDiscount: 0,
  activeReferralDiscount: 0,
  activeStakingDiscount: { bpsOfMaxSupply: 0, discount: 0 },
  userPerpsTakerRate: 0.00025,
  userPerpsMakerRate: 0.00005,
  userSpotTakerRate: 0.0003,
  userSpotMakerRate: 0.0001,
}

export function buildVenueWithFeeSchedule(schedule: FeeSchedule): Venue {
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      feeSchedule: {
        subscribe: (cb) => {
          cb(schedule)
          return () => {}
        },
      },
    },
  }
}

/** A fee-schedule capability that never emits — models the loading state. */
export function buildVenueWithPendingFeeSchedule(): Venue {
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      feeSchedule: {
        subscribe: () => () => {},
      },
    },
  }
}

export function buildVenueWithoutFeeSchedule(): Venue {
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
    },
  }
}
