import { Result } from 'neverthrow'
import { z } from 'zod'

// No logger — watchlist data carries wallet addresses, which must never be logged (logging.md hard rule 1).
// No React imports — this is a pure TS storage service.

const watchlistEntrySchema = z.object({
  address: z.string(),
  label: z.string().optional(),
})

const watchlistPayloadSchema = z.object({
  version: z.literal(1),
  entries: z.array(watchlistEntrySchema),
})

export type WatchlistEntry = z.infer<typeof watchlistEntrySchema>
export type WatchlistPayload = z.infer<typeof watchlistPayloadSchema>

export interface WatchlistStore {
  /** Load the persisted watchlist from localStorage.
   *  Returns ok({ version: 1, entries: [] }) when no entry exists or input is unrecoverable.
   *  Migrates loose legacy shapes (bare string[] of addresses, { addresses: string[] }).
   *  Returns err('storage-read-failed') if localStorage.getItem throws. */
  load(key: string): Result<WatchlistPayload, 'storage-read-failed'>
  /** Persist the watchlist to localStorage.
   *  Returns ok(undefined) on success.
   *  Returns err('storage-write-failed') if localStorage.setItem throws (e.g. QuotaExceededError). */
  save(key: string, payload: WatchlistPayload): Result<void, 'storage-write-failed'>
}

const EMPTY_PAYLOAD: WatchlistPayload = { version: 1, entries: [] }

const legacyAddressArraySchema = z.array(z.string())
const legacyAddressesObjectSchema = z.object({ addresses: z.array(z.string()) })

function entriesFromAddresses(addresses: string[]): WatchlistPayload {
  return { version: 1 as const, entries: addresses.map((address) => ({ address })) }
}

// Accepts unknown input and attempts to coerce it to WatchlistPayload.
// Returns null for any input shape that cannot be migrated.
function migrate(raw: unknown): WatchlistPayload | null {
  const versioned = watchlistPayloadSchema.safeParse(raw)
  if (versioned.success) return versioned.data

  const bareArray = legacyAddressArraySchema.safeParse(raw)
  if (bareArray.success) return entriesFromAddresses(bareArray.data)

  const addressesObject = legacyAddressesObjectSchema.safeParse(raw)
  if (addressesObject.success) return entriesFromAddresses(addressesObject.data.addresses)

  return null
}

// Wrap localStorage.setItem at the boundary — any quota/security exception maps to the literal.
const safeSetItem = Result.fromThrowable(
  (key: string, value: string) => {
    localStorage.setItem(key, value)
  },
  (): 'storage-write-failed' => 'storage-write-failed',
)

// Wrap the entire load body in Result.fromThrowable to capture localStorage.getItem exceptions.
function makeLoadFn(key: string): Result<WatchlistPayload, 'storage-read-failed'> {
  const safeLoad = Result.fromThrowable(
    () => {
      const raw = localStorage.getItem(key)
      if (raw === null) return EMPTY_PAYLOAD
      const parsed: unknown = JSON.parse(raw)
      const migrated = migrate(parsed)
      if (migrated !== null) return migrated
      return EMPTY_PAYLOAD
    },
    (): 'storage-read-failed' => 'storage-read-failed',
  )
  return safeLoad()
}

export function createWatchlistStore(): WatchlistStore {
  return {
    load(key) {
      return makeLoadFn(key)
    },
    save(key, payload) {
      return safeSetItem(key, JSON.stringify(payload))
    },
  }
}
