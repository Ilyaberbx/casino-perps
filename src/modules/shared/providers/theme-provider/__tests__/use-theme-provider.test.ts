import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { useThemeProvider } from '../use-theme-provider'
import {
  THEME_STORAGE_KEY,
  ACCENT_COLOR_STORAGE_KEY,
  LEGACY_ACCENT_COLOR_STORAGE_KEY,
  DEFAULT_ACCENT_COLOR_ID,
  ACCENT_COLORS,
} from '../theme-provider.constants'

describe('useThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('style')
    document.documentElement.className = ''
    vi.restoreAllMocks()
  })

  it('reads theme from localStorage on mount', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'white')
    const { result } = renderHook(() => useThemeProvider())
    expect(result.current.theme).toBe('white')
  })

  it('defaults to dark when localStorage has no stored theme', () => {
    const { result } = renderHook(() => useThemeProvider())
    expect(result.current.theme).toBe('dark')
  })

  it('sets data-theme attribute on html element when theme is applied', () => {
    const { result } = renderHook(() => useThemeProvider())
    act(() => {
      result.current.toggleTheme()
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('white')
  })

  it('persists new theme to localStorage after toggle', () => {
    const { result } = renderHook(() => useThemeProvider())
    act(() => {
      result.current.toggleTheme()
    })
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('white')
  })

  it('toggles back to dark from white', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'white')
    const { result } = renderHook(() => useThemeProvider())
    act(() => {
      result.current.toggleTheme()
    })
    expect(result.current.theme).toBe('dark')
  })

  it('falls back to default theme when localStorage read throws', () => {
    vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    const { result } = renderHook(() => useThemeProvider())
    expect(result.current.theme).toBe('dark')
  })
})

describe('useThemeProvider — accent color', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('style')
    document.documentElement.className = ''
    vi.restoreAllMocks()
  })

  it('exposes the ten predefined colors with cyan as the default', () => {
    const { result } = renderHook(() => useThemeProvider())
    expect(result.current.accentColors).toHaveLength(10)
    expect(result.current.accentColorId).toBe(DEFAULT_ACCENT_COLOR_ID)
    expect(result.current.accentColors[0].id).toBe('cyan')
  })

  it('reads a stored accent color id on mount', () => {
    window.localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, 'mint')
    const { result } = renderHook(() => useThemeProvider())
    expect(result.current.accentColorId).toBe('mint')
  })

  it('falls back to the default when the stored id is not a known color', () => {
    window.localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, 'chartreuse')
    const { result } = renderHook(() => useThemeProvider())
    expect(result.current.accentColorId).toBe(DEFAULT_ACCENT_COLOR_ID)
  })

  it('migrates the legacy primary-color key forward on first load, then deletes it', () => {
    window.localStorage.setItem(LEGACY_ACCENT_COLOR_STORAGE_KEY, 'coral')
    const { result } = renderHook(() => useThemeProvider())
    expect(result.current.accentColorId).toBe('coral')
    expect(window.localStorage.getItem(ACCENT_COLOR_STORAGE_KEY)).toBe('coral')
    expect(window.localStorage.getItem(LEGACY_ACCENT_COLOR_STORAGE_KEY)).toBeNull()
  })

  it('prefers the new key over the legacy key when both exist', () => {
    window.localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, 'mint')
    window.localStorage.setItem(LEGACY_ACCENT_COLOR_STORAGE_KEY, 'coral')
    const { result } = renderHook(() => useThemeProvider())
    expect(result.current.accentColorId).toBe('mint')
    expect(window.localStorage.getItem(LEGACY_ACCENT_COLOR_STORAGE_KEY)).toBe('coral')
  })

  it('persists the chosen color and updates state on setAccentColor', () => {
    const { result } = renderHook(() => useThemeProvider())
    act(() => {
      result.current.setAccentColor('coral')
    })
    expect(result.current.accentColorId).toBe('coral')
    expect(window.localStorage.getItem(ACCENT_COLOR_STORAGE_KEY)).toBe('coral')
  })

  it('overrides the --accent CSS var inline for a non-default color (dark theme)', () => {
    const { result } = renderHook(() => useThemeProvider())
    act(() => {
      result.current.setAccentColor('mint')
    })
    const mint = ACCENT_COLORS.find((color) => color.id === 'mint')
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe(mint?.dark.accent)
    expect(document.documentElement.style.getPropertyValue('--accent-rgb')).toBe(mint?.dark.rgb)
  })

  it('clears the inline --accent overrides when the default cyan is selected', () => {
    const { result } = renderHook(() => useThemeProvider())
    act(() => {
      result.current.setAccentColor('mint')
    })
    act(() => {
      result.current.setAccentColor('cyan')
    })
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('')
  })
})
