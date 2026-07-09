import { err, ok, Result } from 'neverthrow'
import { getAddress } from 'viem'
import { z } from 'zod'
import type {
  CreateRecentRecipientsStoreOptions,
  RecentRecipientsStorage,
  RecentRecipientsStore,
  RecentRecipientsStoreError,
} from './recent-recipients-store.types'

/** Default number of recent recipients retained per user. */
export const DEFAULT_RECENT_RECIPIENTS_LIMIT = 5

const STORAGE_KEY_PREFIX = 'recent-recipients'

const persistedSchema = z.array(z.string())

function buildKey(privyId: string): string {
  return `${STORAGE_KEY_PREFIX}:${privyId}`
}

function coerceStorageError(cause: unknown): RecentRecipientsStoreError {
  return { kind: 'storage', cause }
}

/**
 * Normalise an address to its lowercase checksummed form, or `null` when it is
 * not a valid `0x` address. Storing the lowercase form keeps dedup trivial;
 * `formatWalletAddress` re-checksums it for display.
 */
function normaliseAddress(address: string): string | null {
  const parsed = Result.fromThrowable(
    () => getAddress(address.trim()),
    () => null,
  )()
  return parsed.isOk() ? parsed.value.toLowerCase() : null
}

/** Dedup (case-insensitive, first wins) + cap to `limit`, dropping non-addresses. */
function sanitiseList(raw: ReadonlyArray<string>, limit: number): ReadonlyArray<string> {
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of raw) {
    const normalised = normaliseAddress(entry)
    const isFreshAddress = normalised !== null && !seen.has(normalised)
    if (!isFreshAddress) continue
    seen.add(normalised)
    out.push(normalised)
    if (out.length >= limit) break
  }
  return out
}

function getDefaultStorage(): RecentRecipientsStorage {
  return {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  }
}

/**
 * localStorage-backed recent-recipients store. Mirrors the venue-onboarding
 * seen-store pattern: injectable storage, a Zod-validated schema, and neverthrow
 * `Result`s at every boundary. A corrupt / stale-shape value degrades to an empty
 * list (logged `warn`) rather than throwing.
 */
export function createRecentRecipientsStore(
  options: CreateRecentRecipientsStoreOptions,
): RecentRecipientsStore {
  const storage = options.storage ?? getDefaultStorage()
  const limit = options.limit ?? DEFAULT_RECENT_RECIPIENTS_LIMIT
  const logger = options.logger.child({ module: 'recent-recipients-store' })

  function load(privyId: string): Result<ReadonlyArray<string>, RecentRecipientsStoreError> {
    const key = buildKey(privyId)
    const readResult = Result.fromThrowable(() => storage.getItem(key), coerceStorageError)()
    if (readResult.isErr()) return err(readResult.error)

    const raw = readResult.value
    if (raw === null) return ok([])

    const parseAttempt = Result.fromThrowable(
      () => JSON.parse(raw) as unknown,
      coerceStorageError,
    )()
    if (parseAttempt.isErr()) {
      logger.warn(
        { errorMessage: String(parseAttempt.error.cause) },
        'corrupted recent-recipients json — returning empty',
      )
      return ok([])
    }

    const validated = persistedSchema.safeParse(parseAttempt.value)
    if (!validated.success) {
      logger.warn(
        { errorMessage: validated.error.message },
        'invalid recent-recipients shape — returning empty',
      )
      return ok([])
    }
    return ok(sanitiseList(validated.data, limit))
  }

  function record(
    privyId: string,
    address: string,
  ): Result<ReadonlyArray<string>, RecentRecipientsStoreError> {
    const normalised = normaliseAddress(address)
    const currentResult = load(privyId)
    if (currentResult.isErr()) return err(currentResult.error)
    if (normalised === null) return ok(currentResult.value)

    const next = sanitiseList([normalised, ...currentResult.value], limit)
    const key = buildKey(privyId)
    const writeResult = Result.fromThrowable(
      () => storage.setItem(key, JSON.stringify(next)),
      coerceStorageError,
    )()
    if (writeResult.isErr()) return err(writeResult.error)
    return ok(next)
  }

  return { load, record }
}
