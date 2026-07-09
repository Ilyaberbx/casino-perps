import { describe, expect, it } from 'vitest'
import { createVenueOnboardingSeenStore } from '../venue-onboarding-seen-store'
import { buildFakeLogger, buildFakeStorage } from '../__fixtures__/venue-onboarding-seen-store'

const PRIVY_ID = 'did:privy:abc123'
const VENUE_ID = 'hyperliquid'
const KEY = `venue-onboarding-seen:${PRIVY_ID}:${VENUE_ID}`

describe('createVenueOnboardingSeenStore — load', () => {
  it('returns defaults when no key is present', () => {
    const storage = buildFakeStorage()
    const { logger } = buildFakeLogger()
    const store = createVenueOnboardingSeenStore({ storage, logger })
    const result = store.load(PRIVY_ID, VENUE_ID)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({
      hasSeenOnboarding: false,
      hasSeenMigrationNotice: false,
    })
  })

  it('returns parsed state when key contains valid JSON', () => {
    const storage = buildFakeStorage({
      [KEY]: JSON.stringify({
        hasSeenOnboarding: true,
        hasSeenMigrationNotice: false,
      }),
    })
    const { logger } = buildFakeLogger()
    const store = createVenueOnboardingSeenStore({ storage, logger })
    const result = store.load(PRIVY_ID, VENUE_ID)
    expect(result._unsafeUnwrap()).toEqual({
      hasSeenOnboarding: true,
      hasSeenMigrationNotice: false,
    })
  })

  it('returns defaults and warns when JSON is corrupted', () => {
    const storage = buildFakeStorage({ [KEY]: '{not-json' })
    const fakeLogger = buildFakeLogger()
    const store = createVenueOnboardingSeenStore({ storage, logger: fakeLogger.logger })
    const result = store.load(PRIVY_ID, VENUE_ID)
    expect(result._unsafeUnwrap()).toEqual({
      hasSeenOnboarding: false,
      hasSeenMigrationNotice: false,
    })
    const warnRecord = fakeLogger.records.find((r) => r.level === 'warn')
    expect(warnRecord).toBeDefined()
    expect(warnRecord?.fields.module).toBe('venue-onboarding-seen-store')
  })

  it('returns defaults and warns when shape is invalid', () => {
    const storage = buildFakeStorage({ [KEY]: JSON.stringify({ foo: 1 }) })
    const fakeLogger = buildFakeLogger()
    const store = createVenueOnboardingSeenStore({ storage, logger: fakeLogger.logger })
    const result = store.load(PRIVY_ID, VENUE_ID)
    expect(result._unsafeUnwrap()).toEqual({
      hasSeenOnboarding: false,
      hasSeenMigrationNotice: false,
    })
    expect(fakeLogger.records.some((r) => r.level === 'warn')).toBe(true)
  })
})

describe('createVenueOnboardingSeenStore — mark + reset round-trip', () => {
  it('markAutoOpened persists and load returns it', () => {
    const storage = buildFakeStorage()
    const { logger } = buildFakeLogger()
    const store = createVenueOnboardingSeenStore({ storage, logger })
    const writeResult = store.markAutoOpened(PRIVY_ID, VENUE_ID)
    expect(writeResult.isOk()).toBe(true)
    const loaded = store.load(PRIVY_ID, VENUE_ID)
    expect(loaded._unsafeUnwrap()).toEqual({
      hasSeenOnboarding: true,
      hasSeenMigrationNotice: false,
    })
  })

  it('markMigrationDismissed persists and load returns it', () => {
    const storage = buildFakeStorage()
    const { logger } = buildFakeLogger()
    const store = createVenueOnboardingSeenStore({ storage, logger })
    store.markMigrationDismissed(PRIVY_ID, VENUE_ID)
    expect(store.load(PRIVY_ID, VENUE_ID)._unsafeUnwrap().hasSeenMigrationNotice).toBe(true)
  })

  it('mark calls merge — both flags can coexist', () => {
    const storage = buildFakeStorage()
    const { logger } = buildFakeLogger()
    const store = createVenueOnboardingSeenStore({ storage, logger })
    store.markAutoOpened(PRIVY_ID, VENUE_ID)
    store.markMigrationDismissed(PRIVY_ID, VENUE_ID)
    expect(store.load(PRIVY_ID, VENUE_ID)._unsafeUnwrap()).toEqual({
      hasSeenOnboarding: true,
      hasSeenMigrationNotice: true,
    })
  })

  it('reset removes the key — load returns defaults again', () => {
    const storage = buildFakeStorage()
    const { logger } = buildFakeLogger()
    const store = createVenueOnboardingSeenStore({ storage, logger })
    store.markMigrationDismissed(PRIVY_ID, VENUE_ID)
    expect(storage.data.has(KEY)).toBe(true)
    const resetResult = store.reset(PRIVY_ID, VENUE_ID)
    expect(resetResult.isOk()).toBe(true)
    expect(storage.data.has(KEY)).toBe(false)
    expect(store.load(PRIVY_ID, VENUE_ID)._unsafeUnwrap()).toEqual({
      hasSeenOnboarding: false,
      hasSeenMigrationNotice: false,
    })
  })

  it('uses the canonical key format', () => {
    const storage = buildFakeStorage()
    const { logger } = buildFakeLogger()
    const store = createVenueOnboardingSeenStore({ storage, logger })
    store.markAutoOpened(PRIVY_ID, VENUE_ID)
    expect(storage.data.has(`venue-onboarding-seen:${PRIVY_ID}:${VENUE_ID}`)).toBe(true)
  })

  it('scopes by (privyId, venueId) — different keys do not collide', () => {
    const storage = buildFakeStorage()
    const { logger } = buildFakeLogger()
    const store = createVenueOnboardingSeenStore({ storage, logger })
    store.markMigrationDismissed('did:privy:user1', 'hyperliquid')
    const otherUser = store.load('did:privy:user2', 'hyperliquid')
    const otherVenue = store.load('did:privy:user1', 'mock')
    expect(otherUser._unsafeUnwrap().hasSeenMigrationNotice).toBe(false)
    expect(otherVenue._unsafeUnwrap().hasSeenMigrationNotice).toBe(false)
  })
})
