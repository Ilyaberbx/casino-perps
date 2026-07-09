import { renderHook, act, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { ThemeProvider } from '@/modules/shared/providers/theme-provider'
import { usePnlCardModal } from '../use-pnl-card-modal'
import { ART_PREFS_STORAGE_KEY, CARD_ART, DEFAULT_ART_SELECTION } from '../pnl-card.constants'
import { fromPositionSnapshot, reachableArtKeys } from '../pnl-card.utils'
import { fakePositionSnapshot } from '../__fixtures__/pnl-card-fixtures'
import type { PnlCardArtSelection } from '../pnl-card.types'

const THEME_STORAGE_KEY = 'perps-dex-theme'

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}

const VIEW = fromPositionSnapshot(fakePositionSnapshot())

function seedPersisted(selection: PnlCardArtSelection): void {
  localStorage.setItem(ART_PREFS_STORAGE_KEY, JSON.stringify(selection))
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('usePnlCardModal — seeding', () => {
  it('seeds from persisted prefs when present', () => {
    const persisted: PnlCardArtSelection = { planet: 'mars', mascot: 'cat', theme: 'light' }
    seedPersisted(persisted)
    const { result } = renderHook(() => usePnlCardModal({ view: VIEW }), { wrapper })
    expect(result.current.selection).toEqual(persisted)
    expect(result.current.planetLabel).toBe('Mars')
    expect(result.current.mascotLabel).toBe('Cat')
  })

  it('falls back to the default selection with the app theme when nothing is persisted', () => {
    // App theme white → art theme light, overriding the default dark.
    localStorage.setItem(THEME_STORAGE_KEY, 'white')
    const { result } = renderHook(() => usePnlCardModal({ view: VIEW }), { wrapper })
    expect(result.current.selection).toEqual({
      planet: DEFAULT_ART_SELECTION.planet,
      mascot: DEFAULT_ART_SELECTION.mascot,
      theme: 'light',
    })
  })
})

describe('usePnlCardModal — stepping', () => {
  it('wraps the planet ring forward past the last planet', () => {
    seedPersisted({ planet: 'neptune', mascot: 'bug', theme: 'dark' })
    const { result } = renderHook(() => usePnlCardModal({ view: VIEW }), { wrapper })
    act(() => result.current.onStepPlanet(1))
    expect(result.current.selection.planet).toBe('mercury')
  })

  it('wraps the mascot ring backward past the first mascot', () => {
    seedPersisted({ planet: 'saturn', mascot: 'bug', theme: 'dark' })
    const { result } = renderHook(() => usePnlCardModal({ view: VIEW }), { wrapper })
    act(() => result.current.onStepMascot(-1))
    expect(result.current.selection.mascot).toBe('dino')
  })

  it('persists a change to storage', () => {
    seedPersisted({ planet: 'saturn', mascot: 'dino', theme: 'dark' })
    const { result } = renderHook(() => usePnlCardModal({ view: VIEW }), { wrapper })
    act(() => result.current.onStepPlanet(1))
    const stored = JSON.parse(localStorage.getItem(ART_PREFS_STORAGE_KEY) ?? 'null')
    expect(stored).toEqual({ planet: 'uranus', mascot: 'dino', theme: 'dark' })
  })
})

describe('usePnlCardModal — art warming', () => {
  function warmedUrlsFor(selection: PnlCardArtSelection): Set<string> {
    const loadedUrls = new Set<string>()
    class RecordingImage {
      decoding = ''
      #src = ''
      set src(value: string) {
        this.#src = value
        loadedUrls.add(value)
      }
      get src(): string {
        return this.#src
      }
    }
    const originalImage = globalThis.Image
    // Stub `Image` to capture every preload src; RecordingImage lacks `decode`,
    // so the decode-gate swaps synchronously (matches jsdom's no-decode path).
    globalThis.Image = RecordingImage as unknown as typeof Image
    try {
      seedPersisted(selection)
      renderHook(() => usePnlCardModal({ view: VIEW }), { wrapper })
    } finally {
      globalThis.Image = originalImage
    }
    return loadedUrls
  }

  it('warms only the reachable art keys on open, never all 48', () => {
    const selection: PnlCardArtSelection = { planet: 'saturn', mascot: 'dino', theme: 'dark' }
    const warmed = warmedUrlsFor(selection)
    // Scoped warm: only the neighbours reachable in one picker step (planet ring ∪
    // mascot ring ∪ theme ring for the current selection) are primed — never the
    // full 48-entry CARD_ART, which would be a ~40 MB fetch storm on modal open.
    const reachableUrls = new Set(reachableArtKeys(selection).map((key) => CARD_ART[key]))
    const totalArtCount = Object.keys(CARD_ART).length
    const isBoundedBelowAll = warmed.size < totalArtCount
    expect(warmed.size).toBe(reachableArtKeys(selection).length)
    expect(isBoundedBelowAll).toBe(true)
    expect(warmed).toEqual(reachableUrls)
  })
})

describe('usePnlCardModal — decode-gated art swap', () => {
  it('displayedSelection catches up to the stepped selection once the art is ready', async () => {
    seedPersisted({ planet: 'saturn', mascot: 'dino', theme: 'dark' })
    const { result } = renderHook(() => usePnlCardModal({ view: VIEW }), { wrapper })
    act(() => result.current.onStepPlanet(1))
    expect(result.current.selection.planet).toBe('uranus')
    await waitFor(() => expect(result.current.displayedSelection.planet).toBe('uranus'))
  })

  it('only the latest pick lands on the card under rapid stepping', async () => {
    seedPersisted({ planet: 'mercury', mascot: 'bug', theme: 'dark' })
    const { result } = renderHook(() => usePnlCardModal({ view: VIEW }), { wrapper })
    act(() => result.current.onStepPlanet(1))
    act(() => result.current.onStepPlanet(1))
    act(() => result.current.onStepPlanet(1))
    expect(result.current.selection.planet).toBe('mars')
    await waitFor(() => expect(result.current.displayedSelection.planet).toBe('mars'))
  })
})
