import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChangeEvent, FormEvent } from 'react'
import { CHAT_APPEND_MIN_DELAY_MS, CHAT_MAX_MESSAGES } from '../../../social.constants'
import { CHAT_SEED_MESSAGES } from '../../../social.fixtures'
import { useChat } from '../use-chat'

// Minimal event doubles — the hook only reads `target.value` / calls
// `preventDefault`. Double-cast keeps the test honest without pulling in a DOM.
function changeEvent(value: string): ChangeEvent<HTMLInputElement> {
  return { target: { value } } as unknown as ChangeEvent<HTMLInputElement>
}

function submitEvent(): FormEvent {
  return { preventDefault: vi.fn() } as unknown as FormEvent
}

describe('useChat', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Pin the jitter so each scripted append lands exactly one MIN gap apart.
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('starts with the seed reel on screen', () => {
    const { result } = renderHook(() => useChat())
    expect(result.current.messages).toHaveLength(CHAT_SEED_MESSAGES.length)
    expect(result.current.collapsed).toBe(false)
  })

  it('appends exactly one scripted message per jitter gap', () => {
    const { result } = renderHook(() => useChat())
    const seedCount = CHAT_SEED_MESSAGES.length

    act(() => {
      vi.advanceTimersByTime(CHAT_APPEND_MIN_DELAY_MS)
    })
    expect(result.current.messages).toHaveLength(seedCount + 1)

    act(() => {
      vi.advanceTimersByTime(CHAT_APPEND_MIN_DELAY_MS)
    })
    expect(result.current.messages).toHaveLength(seedCount + 2)
  })

  it('mints unique ids for every appended message', () => {
    const { result } = renderHook(() => useChat())
    act(() => {
      vi.advanceTimersByTime(CHAT_APPEND_MIN_DELAY_MS * 5)
    })
    const ids = result.current.messages.map((message) => message.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('caps retained messages at CHAT_MAX_MESSAGES', () => {
    const { result } = renderHook(() => useChat())
    act(() => {
      vi.advanceTimersByTime(CHAT_APPEND_MIN_DELAY_MS * (CHAT_MAX_MESSAGES + 20))
    })
    expect(result.current.messages).toHaveLength(CHAT_MAX_MESSAGES)
  })

  it('echoes a typed draft locally and clears the input', () => {
    const { result } = renderHook(() => useChat())

    act(() => {
      result.current.handleDraftChange(changeEvent('gm degens'))
    })
    expect(result.current.draft).toBe('gm degens')
    expect(result.current.canSubmit).toBe(true)

    act(() => {
      result.current.handleSubmit(submitEvent())
    })

    const last = result.current.messages[result.current.messages.length - 1]
    expect(last.kind).toBe('text')
    expect(last.kind === 'text' && last.text).toBe('gm degens')
    expect(last.kind === 'text' && last.user.name).toBe('You')
    expect(result.current.draft).toBe('')
  })

  it('ignores a blank draft submit', () => {
    const { result } = renderHook(() => useChat())
    const seedCount = CHAT_SEED_MESSAGES.length

    act(() => {
      result.current.handleDraftChange(changeEvent('   '))
    })
    expect(result.current.canSubmit).toBe(false)

    act(() => {
      result.current.handleSubmit(submitEvent())
    })
    expect(result.current.messages).toHaveLength(seedCount)
  })

  it('toggles collapse state', () => {
    const { result } = renderHook(() => useChat())
    act(() => {
      result.current.onToggleCollapse()
    })
    expect(result.current.collapsed).toBe(true)
    act(() => {
      result.current.onToggleCollapse()
    })
    expect(result.current.collapsed).toBe(false)
  })
})
