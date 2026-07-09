import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { UseIconSelectParams, UseIconSelectReturn } from './icon-select.types'

const TYPEAHEAD_RESET_MS = 500
const OPEN_KEYS = ['ArrowDown', 'ArrowUp', 'Enter', ' ']

/**
 * Owns the listbox state machine for `IconSelect`: open/close, the highlighted
 * (active) option, keyboard navigation (arrows, Home/End, Enter/Space, Escape,
 * type-ahead), outside-click close, and focus return to the trigger. Uses the
 * `aria-activedescendant` pattern — the list owns DOM focus while open and the
 * active option is tracked virtually.
 */
export function useIconSelect(params: UseIconSelectParams): UseIconSelectReturn {
  const { options, value, onChange } = params
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const typeaheadRef = useRef('')
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const baseId = useId()
  const listboxId = `${baseId}-listbox`
  const optionId = useCallback((index: number) => `${baseId}-opt-${index}`, [baseId])

  const selectedIndex = options.findIndex((option) => option.value === value)
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined

  const open = useCallback(() => {
    const firstEnabledIndex = options.findIndex((option) => !option.disabled)
    const isSelectedEnabled = selectedIndex >= 0 && !options[selectedIndex]?.disabled
    const fallbackIndex = firstEnabledIndex >= 0 ? firstEnabledIndex : 0
    const initialActive = isSelectedEnabled ? selectedIndex : fallbackIndex
    setActiveIndex(initialActive)
    setIsOpen(true)
  }, [selectedIndex, options])

  const close = useCallback((returnFocus: boolean) => {
    setIsOpen(false)
    if (!returnFocus) return
    triggerRef.current?.focus()
  }, [])

  const selectIndex = useCallback(
    (index: number) => {
      const option = options[index]
      if (!option) return
      if (option.disabled) return
      onChange(option.value)
      close(true)
    },
    [options, onChange, close],
  )

  // While open the list owns focus; closing by selection/Escape returns it.
  useEffect(() => {
    if (!isOpen) return
    listRef.current?.focus()
  }, [isOpen])

  // Outside-click closes without stealing focus back to the trigger.
  useEffect(() => {
    if (!isOpen) return undefined
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      const insideTrigger = triggerRef.current?.contains(target) ?? false
      const insideList = listRef.current?.contains(target) ?? false
      const isOutside = !insideTrigger && !insideList
      if (!isOutside) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isOpen])

  useEffect(() => {
    return () => {
      if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current)
    }
  }, [])

  const runTypeahead = useCallback(
    (char: string) => {
      typeaheadRef.current += char.toLowerCase()
      const buffer = typeaheadRef.current
      const matchIndex = options.findIndex(
        (option) => !option.disabled && option.label.toLowerCase().startsWith(buffer),
      )
      if (matchIndex >= 0) setActiveIndex(matchIndex)
      if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current)
      typeaheadTimerRef.current = setTimeout(() => {
        typeaheadRef.current = ''
      }, TYPEAHEAD_RESET_MS)
    },
    [options],
  )

  const onTriggerClick = useCallback(() => {
    const willOpen = !isOpen
    if (!willOpen) {
      close(false)
      return
    }
    open()
  }, [isOpen, open, close])

  const onTriggerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const opensList = OPEN_KEYS.includes(event.key)
      if (!opensList) return
      event.preventDefault()
      open()
    },
    [open],
  )

  const onListKeyDown = useCallback(
    (event: KeyboardEvent<HTMLUListElement>) => {
      const lastIndex = options.length - 1
      const isPrintable = event.key.length === 1 && !event.metaKey && !event.ctrlKey
      const isSelectKey = event.key === 'Enter' || event.key === ' '
      // Walk from `start` in `step` direction to the first enabled option, or
      // `fallback` when none exists in that direction (disabled rows are skipped).
      const seekEnabled = (start: number, step: number, fallback: number): number => {
        for (let i = start; i >= 0 && i <= lastIndex; i += step) {
          if (!options[i]?.disabled) return i
        }
        return fallback
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        close(true)
        return
      }
      if (event.key === 'Tab') {
        setIsOpen(false)
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((current) => seekEnabled(current + 1, 1, current))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((current) => seekEnabled(current - 1, -1, current))
        return
      }
      if (event.key === 'Home') {
        event.preventDefault()
        setActiveIndex(seekEnabled(0, 1, 0))
        return
      }
      if (event.key === 'End') {
        event.preventDefault()
        setActiveIndex(seekEnabled(lastIndex, -1, lastIndex))
        return
      }
      if (isSelectKey) {
        event.preventDefault()
        selectIndex(activeIndex)
        return
      }
      if (isPrintable) runTypeahead(event.key)
    },
    [options, activeIndex, close, selectIndex, runTypeahead],
  )

  const onOptionClick = useCallback(
    (index: number) => {
      selectIndex(index)
    },
    [selectIndex],
  )

  return {
    isOpen,
    selectedOption,
    activeIndex,
    triggerRef,
    listRef,
    listboxId,
    optionId,
    onTriggerClick,
    onTriggerKeyDown,
    onListKeyDown,
    onOptionClick,
  }
}
