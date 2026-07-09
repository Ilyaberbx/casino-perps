import { Result } from 'neverthrow'
import type { VenueId } from './venues.types'
import { isVenueId, DEFAULT_VENUE_ID } from './venues'
import { VENUE_STORAGE_KEY } from './venues.constants'

function coerceError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

export function readVenueIdFromStorage(): Result<VenueId, Error> {
  return Result.fromThrowable(
    () => {
      const stored = localStorage.getItem(VENUE_STORAGE_KEY)
      return isVenueId(stored) ? stored : DEFAULT_VENUE_ID
    },
    coerceError,
  )()
}

export function writeVenueIdToStorage(id: VenueId): Result<void, Error> {
  return Result.fromThrowable(
    () => {
      localStorage.setItem(VENUE_STORAGE_KEY, id)
    },
    coerceError,
  )()
}
