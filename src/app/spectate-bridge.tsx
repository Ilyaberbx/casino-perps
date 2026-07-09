import { useEffect } from 'react'
import { useSpectate } from '@/modules/spectate'
import { useVenueOptional } from '@/modules/shared/providers/venue-provider'
import { setSpectatedWalletAddress } from './wallet-address-holder'

/**
 * Writes the active Spectated Address into the wallet-address holder and asks
 * the venue to re-subscribe its live streams to it (ADR-0021). The holder's
 * `spectate ?? connected` precedence means a non-null override re-keys the
 * whole app; clearing it falls back to the connected wallet. The venue is
 * never rebuilt — `refreshAddress()` re-reads the holder closure.
 */
export function SpectateBridge() {
  const { spectatedAddress } = useSpectate()
  const venue = useVenueOptional()

  useEffect(() => {
    setSpectatedWalletAddress(spectatedAddress)
    venue?.refreshAddress?.()
  }, [spectatedAddress, venue])

  return null
}
