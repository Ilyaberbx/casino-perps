import { vi } from 'vitest'
import type { ConnectionStatusSource } from '../../domain'
import type { Logger } from '../../logger'
import type { Venue } from '../../domain/venue'

export function makeFakeLogger(): Logger {
  const logger: Logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    child: () => logger,
  }
  return logger
}

export function makeConnectionSource(): ConnectionStatusSource {
  return {
    status: () => 'connected',
    subscribe: () => () => {},
  }
}

export interface TrackedVenue {
  readonly venue: Venue
  readonly dispose: ReturnType<typeof vi.fn>
  readonly refreshAddress: ReturnType<typeof vi.fn>
}

/**
 * Builds a `createVenue` that returns a fresh fake venue per call and records
 * each one's dispose / refreshAddress spies, so tests can assert the
 * dispose-on-rebuild and address-mirror behaviours.
 */
export function makeVenueTracker() {
  const created: TrackedVenue[] = []
  const createVenue = vi.fn((id: string): Venue => {
    const dispose = vi.fn()
    const refreshAddress = vi.fn()
    const venue: Venue = {
      metadata: { id, label: id },
      capabilities: { connection: makeConnectionSource() },
      dispose,
      refreshAddress,
    }
    created.push({ venue, dispose, refreshAddress })
    return venue
  })
  return { createVenue, created }
}
