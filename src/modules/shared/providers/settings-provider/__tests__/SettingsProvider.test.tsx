import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { ReactNode } from 'react'
import { SettingsProvider } from '../SettingsProvider'
import { useSettings } from '../use-settings'

function wrapper({ children }: { children: ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>
}

describe('SettingsProvider / useSettings', () => {
  it('starts closed on the appearance section', () => {
    const { result } = renderHook(() => useSettings(), { wrapper })
    expect(result.current.isOpen).toBe(false)
    expect(result.current.activeSection).toBe('appearance')
  })

  it('open() opens the modal', () => {
    const { result } = renderHook(() => useSettings(), { wrapper })
    act(() => result.current.open())
    expect(result.current.isOpen).toBe(true)
  })

  it('open(section) opens the modal on that section', () => {
    const { result } = renderHook(() => useSettings(), { wrapper })
    act(() => result.current.open('appearance'))
    expect(result.current.isOpen).toBe(true)
    expect(result.current.activeSection).toBe('appearance')
  })

  it('close() closes the modal', () => {
    const { result } = renderHook(() => useSettings(), { wrapper })
    act(() => result.current.open())
    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)
  })

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useSettings())).toThrow(
      'useSettings must be used inside <SettingsProvider>',
    )
  })
})
