import { describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { PerpSuggestionSheetProvider } from '../PerpSuggestionSheetProvider'
import { usePerpSuggestionSheet } from '../use-perp-suggestion-sheet'

function wrapper({ children }: { children: ReactNode }) {
  return <PerpSuggestionSheetProvider>{children}</PerpSuggestionSheetProvider>
}

describe('usePerpSuggestionSheet', () => {
  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => usePerpSuggestionSheet())).toThrow(
      /must be used inside/i,
    )
  })

  it('starts closed on mount (never auto-opens)', () => {
    const { result } = renderHook(() => usePerpSuggestionSheet(), { wrapper })
    expect(result.current.isOpen).toBe(false)
  })

  it('opens only when open() is called', () => {
    const { result } = renderHook(() => usePerpSuggestionSheet(), { wrapper })
    expect(result.current.isOpen).toBe(false)
    act(() => result.current.open())
    expect(result.current.isOpen).toBe(true)
  })

  it('closes back to false', () => {
    const { result } = renderHook(() => usePerpSuggestionSheet(), { wrapper })
    act(() => result.current.open())
    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)
  })
})
