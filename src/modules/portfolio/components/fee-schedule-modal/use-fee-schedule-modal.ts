import { useEffect, useState } from 'react'
import { useVenue } from '@/modules/shared/providers/venue-provider'
import type { FeeSchedule } from '@/modules/shared/domain'

const EMPTY_SCHEDULE: FeeSchedule = {
  tiers: [],
  currentTierKey: null,
  volumeTiers: [],
  makerRebateTiers: [],
  stakingDiscountTiers: [],
  referralDiscount: 0,
  activeReferralDiscount: 0,
  activeStakingDiscount: { bpsOfMaxSupply: 0, discount: 0 },
  userPerpsTakerRate: 0,
  userPerpsMakerRate: 0,
  userSpotTakerRate: 0,
  userSpotMakerRate: 0,
}

export function useFeeScheduleModal(): FeeSchedule {
  const venue = useVenue()
  const cap = venue.capabilities.feeSchedule
  const [schedule, setSchedule] = useState<FeeSchedule | null>(null)

  useEffect(() => {
    if (!cap) return
    const unsubscribe = cap.subscribe(setSchedule)
    return unsubscribe
  }, [cap])

  if (cap === undefined) return EMPTY_SCHEDULE
  return schedule ?? EMPTY_SCHEDULE
}
