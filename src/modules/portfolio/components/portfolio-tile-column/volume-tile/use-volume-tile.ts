import { useEffect, useState } from 'react'
import { useIsWalletConnected } from '@/modules/account'
import { useVenue } from '@/modules/shared/providers/venue-provider'
import type { PortfolioSnapshot } from '@/modules/shared/domain'
import type { UseVolumeTileReturn } from './volume-tile.types'

const DISCONNECTED_DISPLAY = '--'
const LOADING_DISPLAY = '--'

const VOLUME_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatVolume(value: number): string {
  return VOLUME_FORMATTER.format(value)
}

export function useVolumeTile(): UseVolumeTileReturn {
  const isConnected = useIsWalletConnected()
  const venue = useVenue()
  const portfolioCap = venue.capabilities.portfolio

  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    if (!portfolioCap) return
    const unsubscribe = portfolioCap.subscribeSnapshot('all', (next) => {
      setSnapshot(next)
    })
    return unsubscribe
  }, [portfolioCap])

  const onViewVolume = () => setIsModalOpen(true)
  const onCloseModal = () => setIsModalOpen(false)

  const isDisconnected = !isConnected
  if (isDisconnected) {
    return {
      volumeDisplay: DISCONNECTED_DISPLAY,
      isLoading: false,
      isModalOpen,
      onViewVolume,
      onCloseModal,
    }
  }

  const hasSnapshot = snapshot !== null
  const volumeDisplay = hasSnapshot
    ? formatVolume(snapshot.fourteenDayVolume)
    : LOADING_DISPLAY
  // Loading only while a real read is pending: a venue without the portfolio
  // capability never emits, so it shows `--` rather than an endless skeleton.
  const isLoading = portfolioCap !== undefined && !hasSnapshot

  return {
    volumeDisplay,
    isLoading,
    isModalOpen,
    onViewVolume,
    onCloseModal,
  }
}
