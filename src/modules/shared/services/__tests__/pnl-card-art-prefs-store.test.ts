import { describe, expect, it } from 'vitest'
import { createPnlCardArtPrefsStore } from '../pnl-card-art-prefs-store'
import { ART_PREFS_STORAGE_KEY } from '../../components/pnl-card/pnl-card.constants'
import type { PnlCardArtSelection } from '../../components/pnl-card/pnl-card.types'
import { buildFakeLogger, buildFakeStorage } from '../__fixtures__/venue-onboarding-seen-store'

const SELECTION: PnlCardArtSelection = { planet: 'mars', mascot: 'cat', theme: 'light' }

describe('createPnlCardArtPrefsStore — load', () => {
  it('returns ok(null) when the key is missing', () => {
    const storage = buildFakeStorage()
    const { logger } = buildFakeLogger()
    const store = createPnlCardArtPrefsStore({ storage, logger })
    const result = store.load()
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBeNull()
  })

  it('returns ok(null) and warns when the JSON is corrupt', () => {
    const storage = buildFakeStorage({ [ART_PREFS_STORAGE_KEY]: '{not-json' })
    const fakeLogger = buildFakeLogger()
    const store = createPnlCardArtPrefsStore({ storage, logger: fakeLogger.logger })
    const result = store.load()
    expect(result._unsafeUnwrap()).toBeNull()
    const warnRecord = fakeLogger.records.find((record) => record.level === 'warn')
    expect(warnRecord).toBeDefined()
    expect(warnRecord?.fields.module).toBe('pnl-card-art-prefs-store')
  })

  it('returns ok(null) and warns when the shape is invalid', () => {
    const storage = buildFakeStorage({
      [ART_PREFS_STORAGE_KEY]: JSON.stringify({ planet: 'pluto', mascot: 'cat', theme: 'light' }),
    })
    const fakeLogger = buildFakeLogger()
    const store = createPnlCardArtPrefsStore({ storage, logger: fakeLogger.logger })
    const result = store.load()
    expect(result._unsafeUnwrap()).toBeNull()
    expect(fakeLogger.records.some((record) => record.level === 'warn')).toBe(true)
  })
})

describe('createPnlCardArtPrefsStore — save + load round-trip', () => {
  it('save persists the selection and load returns it verbatim', () => {
    const storage = buildFakeStorage()
    const { logger } = buildFakeLogger()
    const store = createPnlCardArtPrefsStore({ storage, logger })

    const saved = store.save(SELECTION)
    expect(saved.isOk()).toBe(true)

    const loaded = store.load()
    expect(loaded._unsafeUnwrap()).toEqual(SELECTION)
  })

  it('writes under the canonical storage key', () => {
    const storage = buildFakeStorage()
    const { logger } = buildFakeLogger()
    const store = createPnlCardArtPrefsStore({ storage, logger })
    store.save(SELECTION)
    expect(storage.data.has(ART_PREFS_STORAGE_KEY)).toBe(true)
  })
})
