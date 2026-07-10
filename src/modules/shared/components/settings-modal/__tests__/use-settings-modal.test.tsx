import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { ReactNode } from 'react'
import { ThemeProvider } from '../../../providers/theme-provider'
import { SettingsProvider } from '../../../providers/settings-provider'
import { useSettingsModal } from '../use-settings-modal'

function wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SettingsProvider>{children}</SettingsProvider>
    </ThemeProvider>
  )
}

describe('useSettingsModal', () => {
  // Pro mode is gone (PRD-0008 D7): the Trading section was removed, leaving
  // only Appearance.
  it('exposes the appearance section and the ten colors with cyan selected', () => {
    const { result } = renderHook(() => useSettingsModal(), { wrapper })
    expect(result.current.sections.map((section) => section.id)).toEqual(['appearance'])
    expect(result.current.activeSection).toBe('appearance')
    expect(result.current.colors).toHaveLength(10)
    expect(result.current.selectedColorId).toBe('cyan')
  })

  it('onSelectColor changes the selected accent color', () => {
    const { result } = renderHook(() => useSettingsModal(), { wrapper })
    act(() => result.current.onSelectColor('sky'))
    expect(result.current.selectedColorId).toBe('sky')
  })

  it('defaults the theme to dark and onSelectTheme switches it', () => {
    const { result } = renderHook(() => useSettingsModal(), { wrapper })
    expect(result.current.theme).toBe('dark')
    act(() => result.current.onSelectTheme('white'))
    expect(result.current.theme).toBe('white')
  })

  it('onSelectTheme to the current theme is a no-op', () => {
    const { result } = renderHook(() => useSettingsModal(), { wrapper })
    act(() => result.current.onSelectTheme('dark'))
    expect(result.current.theme).toBe('dark')
  })
})
