import { useEffect, useState } from 'react'
import { useVenue } from '@/modules/shared/providers/venue-provider'
import type { FeeSchedule } from '@/modules/shared/domain'
import { DEFAULT_FEES_MARKET } from './fees-tile.constants'
import { formatFeePercent } from './fees-tile.utils'
import type { FeesMarket, SelectedMarketFees, UseFeesTileReturn } from './fees-tile.types'

/** Narrow an arbitrary select value to the `FeesMarket` union. */
function isFeesMarket(value: string): value is FeesMarket {
  return value === 'perps' || value === 'spot'
}

export function useFeesTile(): UseFeesTileReturn {
  const venue = useVenue()
  const feeScheduleCap = venue.capabilities.feeSchedule
  // Pro mode is gone (PRD-0008 D7): everything renders in its condensed form.
  const isSimple = true

  const [schedule, setSchedule] = useState<FeeSchedule | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedMarket, setSelectedMarket] = useState<FeesMarket>(DEFAULT_FEES_MARKET)

  const isUnsupported = feeScheduleCap === undefined

  useEffect(() => {
    if (!feeScheduleCap) return
    const unsubscribe = feeScheduleCap.subscribe((next) => {
      setSchedule(next)
    })
    return unsubscribe
  }, [feeScheduleCap])

  const onViewFeeSchedule = () => setIsModalOpen(true)
  const onCloseModal = () => setIsModalOpen(false)
  const onSelectMarket = (value: string) => {
    if (isFeesMarket(value)) setSelectedMarket(value)
  }

  const baseReturn = {
    isSimple,
    selectedMarket,
    onSelectMarket,
    isModalOpen,
    onViewFeeSchedule,
    onCloseModal,
  }

  if (isUnsupported) {
    return { ...baseReturn, state: { kind: 'unsupported' }, selectedMarketFees: null }
  }

  if (schedule === null) {
    return { ...baseReturn, state: { kind: 'loading' }, selectedMarketFees: null }
  }

  const perpsTier = schedule.tiers.find((t) => t.key === 'perps')
  const spotTier = schedule.tiers.find((t) => t.key === 'spot')

  const hasBothTiers = perpsTier !== undefined && spotTier !== undefined

  if (!hasBothTiers) {
    return { ...baseReturn, state: { kind: 'unsupported' }, selectedMarketFees: null }
  }

  const perpsTakerFee = formatFeePercent(perpsTier.takerBps)
  const perpsMakerFee = formatFeePercent(perpsTier.makerBps)
  const spotTakerFee = formatFeePercent(spotTier.takerBps)
  const spotMakerFee = formatFeePercent(spotTier.makerBps)

  const isPerpsSelected = selectedMarket === 'perps'
  const selectedMarketFees: SelectedMarketFees = isPerpsSelected
    ? { taker: perpsTakerFee, maker: perpsMakerFee }
    : { taker: spotTakerFee, maker: spotMakerFee }

  return {
    ...baseReturn,
    state: {
      kind: 'ready',
      perpsTakerFee,
      perpsMakerFee,
      spotTakerFee,
      spotMakerFee,
    },
    selectedMarketFees,
  }
}
