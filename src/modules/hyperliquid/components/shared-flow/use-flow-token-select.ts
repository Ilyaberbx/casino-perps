import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { FlowSelectableToken, UseFlowTokenSelectInput, UseFlowTokenSelectReturn } from './shared-flow.types'

/**
 * Smart hook for the custom token dropdown. Owns the open/active state and the
 * keyboard model (ArrowUp/Down to move, Home/End to jump, Enter/Space to select,
 * Escape to close, Tab closes), plus the click-outside listener. The component
 * stays dumb. `activeDescendantId` drives `aria-activedescendant` so a screen
 * reader announces the focused option while DOM focus stays on the trigger.
 */
export function useFlowTokenSelect<T extends FlowSelectableToken>(
  input: UseFlowTokenSelectInput<T>,
): UseFlowTokenSelectReturn {
  const { tokens, selectedTokenKey, onSelect, idPrefix } = input

  const baseId = useId()
  const listboxId = `${idPrefix}-token-listbox-${baseId}`
  const optionId = useCallback((index: number) => `${listboxId}-option-${index}`, [listboxId])

  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const listboxRef = useRef<HTMLUListElement | null>(null)

  // Expose the nodes as callback refs (stable), never as ref objects. Returning
  // a `RefObject` and passing it to `ref={}` trips the compiler's
  // `react-hooks/refs` rule ("Cannot access ref value during render").
  const setTriggerRef = useCallback((node: HTMLButtonElement | null) => {
    triggerRef.current = node
  }, [])
  const setWrapRef = useCallback((node: HTMLDivElement | null) => {
    wrapRef.current = node
  }, [])
  const setListboxRef = useCallback((node: HTMLUListElement | null) => {
    listboxRef.current = node
  }, [])

  const selectedIndex = useMemo(() => {
    const index = tokens.findIndex((token) => token.key === selectedTokenKey)
    return index === -1 ? 0 : index
  }, [tokens, selectedTokenKey])

  const open = useCallback(() => {
    setActiveIndex(selectedIndex)
    setIsOpen(true)
  }, [selectedIndex])

  const close = useCallback(() => {
    setIsOpen(false)
    triggerRef.current?.focus()
  }, [])

  const commit = useCallback(
    (index: number) => {
      const token = tokens[index]
      if (token === undefined) return
      onSelect(token.key)
      setIsOpen(false)
      triggerRef.current?.focus()
    },
    [tokens, onSelect],
  )

  const moveActive = useCallback(
    (delta: number) => {
      const lastIndex = tokens.length - 1
      if (lastIndex < 0) return
      setActiveIndex((current) => {
        const next = current + delta
        if (next < 0) return 0
        if (next > lastIndex) return lastIndex
        return next
      })
    },
    [tokens.length],
  )

  // Move keyboard focus into the listbox when it opens so Arrow/Enter/Escape are
  // captured. Done in an effect (not an inline focusing ref) to keep render pure.
  useEffect(() => {
    if (!isOpen) return
    listboxRef.current?.focus()
  }, [isOpen])

  // Close on a click outside the dropdown wrapper.
  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      const isInside = target !== null && wrapRef.current?.contains(target) === true
      if (isInside) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  const onTriggerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const isOpenKey = event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' '
      if (isOpenKey) {
        event.preventDefault()
        open()
      }
    },
    [open],
  )

  const onListboxKeyDown = useCallback(
    (event: KeyboardEvent<HTMLUListElement>) => {
      const key = event.key
      const isClose = key === 'Escape' || key === 'Tab'
      if (isClose) {
        event.preventDefault()
        close()
        return
      }
      if (key === 'ArrowDown') {
        event.preventDefault()
        moveActive(1)
        return
      }
      if (key === 'ArrowUp') {
        event.preventDefault()
        moveActive(-1)
        return
      }
      if (key === 'Home') {
        event.preventDefault()
        setActiveIndex(0)
        return
      }
      if (key === 'End') {
        event.preventDefault()
        setActiveIndex(tokens.length - 1)
        return
      }
      const isSelect = key === 'Enter' || key === ' '
      if (isSelect) {
        event.preventDefault()
        commit(activeIndex)
      }
    },
    [close, moveActive, commit, activeIndex, tokens.length],
  )

  const toggle = useCallback(() => {
    const willOpen = !isOpen
    if (willOpen) {
      open()
      return
    }
    setIsOpen(false)
  }, [isOpen, open])

  return {
    isOpen,
    activeIndex,
    selectedIndex,
    listboxId,
    optionId,
    activeDescendantId: isOpen ? optionId(activeIndex) : undefined,
    setTriggerRef,
    setWrapRef,
    setListboxRef,
    toggle,
    onTriggerKeyDown,
    onListboxKeyDown,
    onOptionPointerEnter: setActiveIndex,
    onOptionClick: commit,
  }
}
