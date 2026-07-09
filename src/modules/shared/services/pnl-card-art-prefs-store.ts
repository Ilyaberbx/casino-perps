import { err, ok, Result } from 'neverthrow'
import { z } from 'zod'
import {
  ART_PREFS_STORAGE_KEY,
  ART_THEMES,
  MASCOTS,
  PLANETS,
} from '../components/pnl-card/pnl-card.constants'
import type {
  PnlCardArtSelection,
  PnlCardArtTheme,
  PnlCardMascot,
  PnlCardPlanet,
} from '../components/pnl-card/pnl-card.types'
import type {
  CreatePnlCardArtPrefsStoreOptions,
  PnlCardArtPrefsState,
  PnlCardArtPrefsStorage,
  PnlCardArtPrefsStore,
  PnlCardArtPrefsStoreError,
} from './pnl-card-art-prefs-store.types'

/**
 * Browser-global persistence for the PnL card art picks (planet × mascot × theme).
 * Not per-user — the picks are a UI preference, keyed by a single localStorage key
 * (`ART_PREFS_STORAGE_KEY`). Reads are graceful: a missing key, corrupt JSON, or a
 * stale shape all resolve to `ok(null)` (logged `warn`) so the modal falls back to
 * the default selection + current app theme rather than surfacing an error.
 *
 * Mirrors `venue-onboarding-seen-store` — an injectable `Storage` port, neverthrow
 * (`Result.fromThrowable`) for every IO/parse boundary (no `try/catch`), and a Zod
 * schema that validates each axis against its canonical ring.
 */

// `z.enum` needs a non-empty literal tuple. PLANETS / MASCOTS / ART_THEMES are the
// canonical, non-empty ordered rings from `pnl-card.constants`, so widening each to
// a non-empty tuple is sound — they are never empty and z.enum checks membership at
// runtime against the exact array values.
const planetSchema = z.enum(PLANETS as unknown as [PnlCardPlanet, ...PnlCardPlanet[]])
const mascotSchema = z.enum(MASCOTS as unknown as [PnlCardMascot, ...PnlCardMascot[]])
const themeSchema = z.enum(ART_THEMES as unknown as [PnlCardArtTheme, ...PnlCardArtTheme[]])

const selectionSchema = z.object({
  planet: planetSchema,
  mascot: mascotSchema,
  theme: themeSchema,
})

function coerceStorageError(cause: unknown): PnlCardArtPrefsStoreError {
  return { kind: 'storage', cause }
}

function getDefaultStorage(): PnlCardArtPrefsStorage {
  return {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  }
}

export function createPnlCardArtPrefsStore(
  options: CreatePnlCardArtPrefsStoreOptions,
): PnlCardArtPrefsStore {
  const storage = options.storage ?? getDefaultStorage()
  const logger = options.logger.child({ module: 'pnl-card-art-prefs-store' })

  function load(): Result<PnlCardArtPrefsState | null, PnlCardArtPrefsStoreError> {
    const readResult = Result.fromThrowable(
      () => storage.getItem(ART_PREFS_STORAGE_KEY),
      coerceStorageError,
    )()
    if (readResult.isErr()) return err(readResult.error)

    const raw = readResult.value
    if (raw === null) return ok(null)

    const parseAttempt = Result.fromThrowable(
      () => JSON.parse(raw) as unknown,
      coerceStorageError,
    )()
    if (parseAttempt.isErr()) {
      logger.warn(
        { errorMessage: String(parseAttempt.error.cause) },
        'corrupt art prefs json — falling back to default',
      )
      return ok(null)
    }

    const validated = selectionSchema.safeParse(parseAttempt.value)
    if (!validated.success) {
      logger.warn(
        { errorMessage: validated.error.message },
        'invalid art prefs shape — falling back to default',
      )
      return ok(null)
    }
    return ok(validated.data)
  }

  function save(selection: PnlCardArtSelection): Result<void, PnlCardArtPrefsStoreError> {
    return Result.fromThrowable(
      () => storage.setItem(ART_PREFS_STORAGE_KEY, JSON.stringify(selection)),
      coerceStorageError,
    )()
  }

  return { load, save }
}
