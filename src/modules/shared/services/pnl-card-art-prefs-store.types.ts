import type { Result } from 'neverthrow'
import type { Logger } from '../logger'
import type { PnlCardArtSelection } from '../components/pnl-card/pnl-card.types'

/**
 * Storage port for the PnL card art prefs — a narrow `getItem`/`setItem` slice of
 * the `Storage` interface. Injectable so the store is unit-testable without a real
 * `localStorage`. Defaults to `localStorage` in the factory.
 */
export interface PnlCardArtPrefsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** The only failure mode: the underlying storage read/write threw. */
export type PnlCardArtPrefsStoreError = { kind: 'storage'; cause: unknown }

/**
 * The parsed, schema-validated persisted state — structurally the user's art
 * selection. `null` models "nothing valid persisted yet" (missing key or a
 * corrupt / stale-shape value the schema rejected).
 */
export type PnlCardArtPrefsState = PnlCardArtSelection

export interface CreatePnlCardArtPrefsStoreOptions {
  readonly storage?: PnlCardArtPrefsStorage
  readonly logger: Logger
}

export interface PnlCardArtPrefsStore {
  /** Read the persisted selection. `ok(null)` on missing / corrupt (logged warn),
   *  so callers can fall back to the default + app theme themselves. */
  load(): Result<PnlCardArtPrefsState | null, PnlCardArtPrefsStoreError>
  /** Persist the selection. Fire-and-forget at the callsite. */
  save(selection: PnlCardArtSelection): Result<void, PnlCardArtPrefsStoreError>
}
