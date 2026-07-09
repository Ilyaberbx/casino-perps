import { useState, useEffect, useCallback } from 'react'
import { Result } from 'neverthrow'
import type {
  AccentColor,
  AccentColorId,
  ThemeVariant,
  UseThemeProviderReturn,
} from './theme-provider.types'
import {
  THEME_STORAGE_KEY,
  DEFAULT_THEME,
  DATA_THEME_ATTRIBUTE,
  FAVICON_HREF_BY_THEME,
  ACCENT_COLOR_STORAGE_KEY,
  LEGACY_ACCENT_COLOR_STORAGE_KEY,
  DEFAULT_ACCENT_COLOR_ID,
  ACCENT_COLORS,
} from './theme-provider.constants'

/** The four inline CSS vars the picker overrides on :root; everything derived
 * (soft / glow / gradient / focus-ring) re-tints from these via `index.css`. */
const ACCENT_CSS_VARS = ['--accent', '--accent-rgb', '--accent-hover', '--accent-secondary'] as const

function coerceError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function readThemeFromStorage(): Result<ThemeVariant, Error> {
  return Result.fromThrowable(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    const isValidTheme = stored === 'dark' || stored === 'white'
    return isValidTheme ? (stored as ThemeVariant) : DEFAULT_THEME
  }, coerceError)()
}

function writeThemeToStorage(theme: ThemeVariant): Result<void, Error> {
  return Result.fromThrowable(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, coerceError)()
}

function isAccentColorId(value: string | null): value is AccentColorId {
  return ACCENT_COLORS.some((color) => color.id === value)
}

/**
 * One-time forward migration of the renamed key (#256). When the new key is
 * absent but the old "primary color" key exists, copy the value forward and drop
 * the old key so an existing user keeps their chosen colour. No-op once migrated.
 */
function migrateLegacyAccentColorKey(): void {
  const hasNewKey = localStorage.getItem(ACCENT_COLOR_STORAGE_KEY) !== null
  if (hasNewKey) return
  const legacyValue = localStorage.getItem(LEGACY_ACCENT_COLOR_STORAGE_KEY)
  if (legacyValue === null) return
  localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, legacyValue)
  localStorage.removeItem(LEGACY_ACCENT_COLOR_STORAGE_KEY)
}

function readAccentColorFromStorage(): Result<AccentColorId, Error> {
  return Result.fromThrowable(() => {
    migrateLegacyAccentColorKey()
    const stored = localStorage.getItem(ACCENT_COLOR_STORAGE_KEY)
    return isAccentColorId(stored) ? stored : DEFAULT_ACCENT_COLOR_ID
  }, coerceError)()
}

function writeAccentColorToStorage(id: AccentColorId): Result<void, Error> {
  return Result.fromThrowable(() => {
    localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, id)
  }, coerceError)()
}

function findAccentColor(id: AccentColorId): AccentColor {
  // ACCENT_COLORS contains every id; the fallback is purely defensive.
  return ACCENT_COLORS.find((color) => color.id === id) ?? ACCENT_COLORS[0]
}

function applyFaviconForTheme(theme: ThemeVariant): void {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) return
  link.href = FAVICON_HREF_BY_THEME[theme]
}

function applyThemeToDocument(theme: ThemeVariant): void {
  document.documentElement.setAttribute(DATA_THEME_ATTRIBUTE, theme)
  applyFaviconForTheme(theme)
}

/**
 * Re-tints the whole app to the chosen accent color by overriding the accent
 * CSS vars inline on :root. The default (`cyan`) clears the overrides so the
 * stylesheet's own per-theme cyan drives — guaranteeing zero drift from the
 * shipped look. Every other color applies the variant tuned for the live theme.
 */
function applyAccentToDocument(id: AccentColorId, theme: ThemeVariant): void {
  const root = document.documentElement
  const isDefaultColor = id === DEFAULT_ACCENT_COLOR_ID
  if (isDefaultColor) {
    ACCENT_CSS_VARS.forEach((cssVar) => root.style.removeProperty(cssVar))
    return
  }
  const color = findAccentColor(id)
  const variant = theme === 'dark' ? color.dark : color.white
  root.style.setProperty('--accent', variant.accent)
  root.style.setProperty('--accent-rgb', variant.rgb)
  root.style.setProperty('--accent-hover', variant.hover)
  root.style.setProperty('--accent-secondary', variant.secondary)
}

export function useThemeProvider(): UseThemeProviderReturn {
  const [theme, setTheme] = useState<ThemeVariant>(() => {
    const result = readThemeFromStorage()
    return result.isOk() ? result.value : DEFAULT_THEME
  })

  const [accentColorId, setAccentColorId] = useState<AccentColorId>(() => {
    const result = readAccentColorFromStorage()
    return result.isOk() ? result.value : DEFAULT_ACCENT_COLOR_ID
  })

  useEffect(() => {
    applyThemeToDocument(theme)
    writeThemeToStorage(theme)
  }, [theme])

  useEffect(() => {
    applyAccentToDocument(accentColorId, theme)
    writeAccentColorToStorage(accentColorId)
  }, [accentColorId, theme])

  const toggleTheme = useCallback(() => {
    setTheme((previous) => {
      const next = previous === 'dark' ? 'white' : 'dark'
      // Apply to DOM synchronously so child effects that read CSS vars during the
      // same render observe the new theme + accent. Parent useEffect runs after
      // child useEffects, so deferring leaves children one toggle behind.
      applyThemeToDocument(next)
      applyAccentToDocument(accentColorId, next)
      return next
    })
  }, [accentColorId])

  const setAccentColor = useCallback(
    (id: AccentColorId) => {
      applyAccentToDocument(id, theme)
      setAccentColorId(id)
    },
    [theme],
  )

  return {
    theme,
    toggleTheme,
    accentColorId,
    accentColors: ACCENT_COLORS,
    setAccentColor,
  }
}
