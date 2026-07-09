import { err, ok, Result } from 'neverthrow'
import { z } from 'zod'
import type { Logger } from '../logger'

/**
 * Per-(Privy DID + venue id) onboarding seen-state. Persisted to localStorage.
 *
 * - `hasSeenOnboarding` — used by the L2 auto-open trigger (slice 10) to fire
 *   exactly once per (user, venue) pair.
 * - `hasSeenMigrationNotice` — used by slice 9 to suppress the migration
 *   notice in the sheet after the user has dismissed it once.
 */
export interface SeenState {
  readonly hasSeenOnboarding: boolean
  readonly hasSeenMigrationNotice: boolean
}

export interface VenueOnboardingSeenStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type SeenStoreError =
  | { kind: 'storage'; cause: unknown }

export interface VenueOnboardingSeenStore {
  load(privyId: string, venueId: string): Result<SeenState, SeenStoreError>
  markAutoOpened(privyId: string, venueId: string): Result<void, SeenStoreError>
  markMigrationDismissed(privyId: string, venueId: string): Result<void, SeenStoreError>
  reset(privyId: string, venueId: string): Result<void, SeenStoreError>
}

export interface CreateVenueOnboardingSeenStoreOptions {
  readonly storage?: VenueOnboardingSeenStorage
  readonly logger: Logger
}

const DEFAULT_STATE: SeenState = {
  hasSeenOnboarding: false,
  hasSeenMigrationNotice: false,
}

const seenStateSchema = z.object({
  hasSeenOnboarding: z.boolean(),
  hasSeenMigrationNotice: z.boolean(),
})

const STORAGE_KEY_PREFIX = 'venue-onboarding-seen'

function buildKey(privyId: string, venueId: string): string {
  return `${STORAGE_KEY_PREFIX}:${privyId}:${venueId}`
}

function coerceStorageError(cause: unknown): SeenStoreError {
  return { kind: 'storage', cause }
}

function getDefaultStorage(): VenueOnboardingSeenStorage {
  return {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
    removeItem: (key) => localStorage.removeItem(key),
  }
}

export function createVenueOnboardingSeenStore(
  options: CreateVenueOnboardingSeenStoreOptions,
): VenueOnboardingSeenStore {
  const storage = options.storage ?? getDefaultStorage()
  const logger = options.logger.child({ module: 'venue-onboarding-seen-store' })

  function load(privyId: string, venueId: string): Result<SeenState, SeenStoreError> {
    const key = buildKey(privyId, venueId)
    const readResult = Result.fromThrowable(
      () => storage.getItem(key),
      coerceStorageError,
    )()
    if (readResult.isErr()) return err(readResult.error)

    const raw = readResult.value
    if (raw === null) return ok(DEFAULT_STATE)

    const parseAttempt = Result.fromThrowable(
      () => JSON.parse(raw) as unknown,
      coerceStorageError,
    )()
    if (parseAttempt.isErr()) {
      logger.warn(
        { venueId, errorMessage: String(parseAttempt.error.cause) },
        'corrupted seen-state json — returning defaults',
      )
      return ok(DEFAULT_STATE)
    }

    const validated = seenStateSchema.safeParse(parseAttempt.value)
    if (!validated.success) {
      logger.warn(
        { venueId, errorMessage: validated.error.message },
        'invalid seen-state shape — returning defaults',
      )
      return ok(DEFAULT_STATE)
    }
    return ok(validated.data)
  }

  function update(
    privyId: string,
    venueId: string,
    patch: Partial<SeenState>,
  ): Result<void, SeenStoreError> {
    const currentResult = load(privyId, venueId)
    if (currentResult.isErr()) return err(currentResult.error)
    const next: SeenState = { ...currentResult.value, ...patch }
    const key = buildKey(privyId, venueId)
    return Result.fromThrowable(
      () => storage.setItem(key, JSON.stringify(next)),
      coerceStorageError,
    )()
  }

  function markAutoOpened(privyId: string, venueId: string): Result<void, SeenStoreError> {
    return update(privyId, venueId, { hasSeenOnboarding: true })
  }

  function markMigrationDismissed(
    privyId: string,
    venueId: string,
  ): Result<void, SeenStoreError> {
    return update(privyId, venueId, { hasSeenMigrationNotice: true })
  }

  function reset(privyId: string, venueId: string): Result<void, SeenStoreError> {
    const key = buildKey(privyId, venueId)
    return Result.fromThrowable(
      () => storage.removeItem(key),
      coerceStorageError,
    )()
  }

  return { load, markAutoOpened, markMigrationDismissed, reset }
}
