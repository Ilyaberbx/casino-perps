import { useEffect, useState } from 'react'
import { useVenue } from '@/modules/shared/providers/venue-provider'
import type { VolumeHistory } from '@/modules/shared/domain'

const EMPTY_HISTORY: VolumeHistory = { entries: [] }

export function useVolumeHistoryModal(): VolumeHistory {
  const venue = useVenue()
  const cap = venue.capabilities.volumeHistory
  const [history, setHistory] = useState<VolumeHistory | null>(null)

  useEffect(() => {
    if (!cap) return
    const unsubscribe = cap.subscribe(setHistory)
    return unsubscribe
  }, [cap])

  if (cap === undefined) return EMPTY_HISTORY
  return history ?? EMPTY_HISTORY
}
