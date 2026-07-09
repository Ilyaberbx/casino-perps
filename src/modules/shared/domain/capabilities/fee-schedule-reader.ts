import type { Unsubscribe } from '../domain.types'

/**
 * The user's current per-market summary tier ("perps", "spot") used by the
 * portfolio tile. `takerBps` / `makerBps` are the user's effective rates in
 * basis points (rate * 10_000).
 */
export interface FeeTier {
  readonly key: string
  readonly label: string
  readonly takerBps: number
  readonly makerBps: number
  readonly hint?: string
}

/**
 * One row of the venue's VIP volume-tier table. Cross / add rates are the
 * raw fractional rates as published by the venue (e.g. `0.00045`); the renderer
 * formats them as percentages.
 */
export interface VolumeTierRow {
  readonly key: string
  readonly label: string
  readonly notionalCutoff: number
  readonly perpsTaker: number
  readonly perpsMaker: number
  readonly spotTaker: number
  readonly spotMaker: number
}

/**
 * One row of the venue's market-maker fee/rebate tier table. `addRate` is the
 * fractional rate; negative values denote a rebate.
 */
export interface MakerRebateTierRow {
  readonly makerFractionCutoff: number
  readonly addRate: number
}

/**
 * One row of the venue's staking-discount tier table.
 */
export interface StakingDiscountTierRow {
  readonly bpsOfMaxSupply: number
  readonly discount: number
}

/**
 * The user's current staking discount, as resolved by the venue from their
 * stake position. `discount` of 0 means no active stake.
 */
export interface ActiveStakingDiscount {
  readonly bpsOfMaxSupply: number
  readonly discount: number
}

export interface FeeSchedule {
  readonly tiers: ReadonlyArray<FeeTier>
  readonly currentTierKey: string | null
  readonly volumeTiers: ReadonlyArray<VolumeTierRow>
  readonly makerRebateTiers: ReadonlyArray<MakerRebateTierRow>
  readonly stakingDiscountTiers: ReadonlyArray<StakingDiscountTierRow>
  readonly referralDiscount: number
  readonly activeReferralDiscount: number
  readonly activeStakingDiscount: ActiveStakingDiscount
  readonly userPerpsTakerRate: number
  readonly userPerpsMakerRate: number
  readonly userSpotTakerRate: number
  readonly userSpotMakerRate: number
}

export interface FeeScheduleReader {
  subscribe(onUpdate: (schedule: FeeSchedule) => void): Unsubscribe
}
