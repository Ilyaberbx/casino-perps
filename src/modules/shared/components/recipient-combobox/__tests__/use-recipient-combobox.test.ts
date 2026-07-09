import { describe, expect, it, vi } from 'vitest'
import type { KeyboardEvent } from 'react'
import { act, renderHook } from '@testing-library/react'
import { useRecipientCombobox } from '../use-recipient-combobox'
import type { RecipientSuggestion } from '../recipient-combobox.types'

const NATIVE: RecipientSuggestion = {
  address: '0x1111111111111111111111111111111111111111',
  title: 'Native',
  subtitle: '0x1111…1111',
}
const IMPORTED: RecipientSuggestion = {
  address: '0x2222222222222222222222222222222222222222',
  title: '0x2222…2222',
  subtitle: 'Imported',
}
const RECENT: RecipientSuggestion = {
  address: '0x3333333333333333333333333333333333333333',
  title: '0x3333…3333',
  subtitle: null,
}

function key(name: string): KeyboardEvent<HTMLInputElement> {
  return { key: name, preventDefault: vi.fn() } as unknown as KeyboardEvent<HTMLInputElement>
}

function setup(value = '') {
  const onChange = vi.fn()
  const view = renderHook(
    (props: { value: string }) =>
      useRecipientCombobox({
        value: props.value,
        walletSuggestions: [NATIVE, IMPORTED],
        recentSuggestions: [RECENT],
        onChange,
        inputId: 'recipient',
        label: 'Recipient',
        hint: null,
        ariaLabel: 'Recipient',
        placeholder: '0x…',
        isInvalid: false,
        invalidReason: null,
      }),
    { initialProps: { value } },
  )
  return { onChange, ...view }
}

describe('useRecipientCombobox — open/close + groups', () => {
  it('starts closed and opens on focus with both groups', () => {
    const { result } = setup()
    expect(result.current.isOpen).toBe(false)
    expect(result.current.hasSuggestions).toBe(true)
    act(() => result.current.onFocus())
    expect(result.current.isOpen).toBe(true)
    expect(result.current.groups.map((g) => g.heading)).toEqual(['Your wallets', 'Recent'])
    expect(result.current.groups.flatMap((g) => g.options)).toHaveLength(3)
  })

  it('is not open when there are no suggestions', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useRecipientCombobox({
        value: '',
        walletSuggestions: [],
        recentSuggestions: [],
        onChange,
        inputId: 'recipient',
        label: 'Recipient',
        hint: null,
        ariaLabel: 'Recipient',
        placeholder: '0x…',
        isInvalid: false,
        invalidReason: null,
      }),
    )
    act(() => result.current.onFocus())
    expect(result.current.isOpen).toBe(false)
    expect(result.current.hasSuggestions).toBe(false)
  })

  it('threads the presentational config through to the view', () => {
    const { result } = setup()
    expect(result.current.label).toBe('Recipient')
    expect(result.current.placeholder).toBe('0x…')
    expect(result.current.inputId).toBe('recipient')
  })
})

describe('useRecipientCombobox — filtering', () => {
  it('filters across address, title and subtitle', () => {
    const { result, rerender } = setup()
    act(() => result.current.onFocus())
    rerender({ value: 'Imported' })
    const flat = result.current.groups.flatMap((g) => g.options)
    expect(flat.map((o) => o.address)).toEqual([IMPORTED.address])
  })
})

describe('useRecipientCombobox — selection + keyboard', () => {
  it('selecting an option writes it and closes the panel', () => {
    const { result, onChange } = setup()
    act(() => result.current.onFocus())
    act(() => result.current.onSelect(RECENT.address))
    expect(onChange).toHaveBeenCalledWith(RECENT.address)
    expect(result.current.isOpen).toBe(false)
  })

  it('ArrowDown moves the active option and Enter selects it', () => {
    const { result, onChange } = setup()
    act(() => result.current.onFocus())
    // active starts at index 0 (Native); ArrowDown → index 1 (Imported).
    act(() => result.current.onKeyDown(key('ArrowDown')))
    expect(result.current.activeOptionId).toBe('recipient-combobox-option-1')
    act(() => result.current.onKeyDown(key('Enter')))
    expect(onChange).toHaveBeenCalledWith(IMPORTED.address)
  })

  it('Escape closes the panel', () => {
    const { result } = setup()
    act(() => result.current.onFocus())
    act(() => result.current.onKeyDown(key('Escape')))
    expect(result.current.isOpen).toBe(false)
  })
})
