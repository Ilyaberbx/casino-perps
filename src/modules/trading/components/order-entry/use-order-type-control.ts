import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { PRO_TYPE_DESCRIPTORS, PRO_SEGMENT_DEFAULT_LABEL } from './order-entry.constants'
import type {
  OrderType,
  ProType,
  ProTypeDescriptor,
  UseOrderTypeControlParams,
  UseOrderTypeControlReturn,
} from './order-entry.types'

const OPEN_KEYS = ['ArrowDown', 'ArrowUp', 'Enter', ' ']
const PRO_TYPES: ReadonlyArray<ProType> = ['stop-market', 'stop-limit', 'twap']

function isProType(orderType: OrderType): orderType is ProType {
  return PRO_TYPES.includes(orderType as ProType)
}

/** The Pro descriptors whose capability flag is currently advertised, kept in
 *  reference order. Empty when neither flag is set (3rd segment omitted). */
function filterProDescriptors(
  supportsStopOrders: boolean,
  supportsTwap: boolean,
): ReadonlyArray<ProTypeDescriptor> {
  const isFlagSet: Record<ProTypeDescriptor['flag'], boolean> = {
    supportsStopOrders,
    supportsTwap,
  }
  return PRO_TYPE_DESCRIPTORS.filter((descriptor) => isFlagSet[descriptor.flag])
}

/**
 * Owns the order-type control's state machine: the two direct Market/Limit
 * selects plus the Pro dropdown (open/close, virtual-focus active option, arrow
 * navigation, Enter/Space select, Escape close + focus return, outside-click
 * close). Mirrors `useIconSelect`'s listbox pattern but the trigger is the 3rd
 * segment of the segmented row, so the hook is colocated here rather than reusing
 * `IconSelect` (whose trigger is its own button). Render-only state for
 * `OrderTypeControl` + `ProTypeMenu`.
 */
export function useOrderTypeControl(
  params: UseOrderTypeControlParams,
): UseOrderTypeControlReturn {
  const { orderType, supportsStopOrders, supportsTwap, onOrderTypeChange } = params

  const proDescriptors = useMemo(
    () => filterProDescriptors(supportsStopOrders, supportsTwap),
    [supportsStopOrders, supportsTwap],
  )
  const hasProTypes = proDescriptors.length > 0

  const activeProType = isProType(orderType) ? orderType : null
  const isProActive = activeProType !== null

  const activeDescriptor = proDescriptors.find(
    (descriptor) => descriptor.value === activeProType,
  )
  const proSegmentLabel = activeDescriptor?.label ?? PRO_SEGMENT_DEFAULT_LABEL

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)

  const baseId = useId()
  const listboxId = `${baseId}-pro-listbox`
  const optionId = useCallback((index: number) => `${baseId}-pro-opt-${index}`, [baseId])

  const selectedIndex = proDescriptors.findIndex(
    (descriptor) => descriptor.value === activeProType,
  )

  const open = useCallback(() => {
    const initialActive = selectedIndex >= 0 ? selectedIndex : 0
    setActiveIndex(initialActive)
    setIsMenuOpen(true)
  }, [selectedIndex])

  const close = useCallback((returnFocus: boolean) => {
    setIsMenuOpen(false)
    if (!returnFocus) return
    triggerRef.current?.focus()
  }, [])

  const selectProIndex = useCallback(
    (index: number) => {
      const descriptor = proDescriptors[index]
      if (!descriptor) return
      onOrderTypeChange(descriptor.value)
      close(true)
    },
    [proDescriptors, onOrderTypeChange, close],
  )

  // While open the list owns DOM focus; closing by selection/Escape returns it.
  useEffect(() => {
    if (!isMenuOpen) return
    listRef.current?.focus()
  }, [isMenuOpen])

  // Outside-click closes without stealing focus back to the trigger.
  useEffect(() => {
    if (!isMenuOpen) return undefined
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      const insideTrigger = triggerRef.current?.contains(target) ?? false
      const insideList = listRef.current?.contains(target) ?? false
      const isOutside = !insideTrigger && !insideList
      if (!isOutside) return
      setIsMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isMenuOpen])

  const selectMarket = useCallback(() => {
    setIsMenuOpen(false)
    onOrderTypeChange('market')
  }, [onOrderTypeChange])

  const selectLimit = useCallback(() => {
    setIsMenuOpen(false)
    onOrderTypeChange('limit')
  }, [onOrderTypeChange])

  const onTriggerClick = useCallback(() => {
    const willOpen = !isMenuOpen
    if (!willOpen) {
      close(false)
      return
    }
    open()
  }, [isMenuOpen, open, close])

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
      const lastIndex = proDescriptors.length - 1
      const isSelectKey = event.key === 'Enter' || event.key === ' '

      if (event.key === 'Escape') {
        event.preventDefault()
        close(true)
        return
      }
      if (event.key === 'Tab') {
        setIsMenuOpen(false)
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((current) => Math.min(current + 1, lastIndex))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((current) => Math.max(current - 1, 0))
        return
      }
      if (event.key === 'Home') {
        event.preventDefault()
        setActiveIndex(0)
        return
      }
      if (event.key === 'End') {
        event.preventDefault()
        setActiveIndex(lastIndex)
        return
      }
      if (isSelectKey) {
        event.preventDefault()
        selectProIndex(activeIndex)
      }
    },
    [proDescriptors.length, activeIndex, close, selectProIndex],
  )

  const onOptionClick = useCallback(
    (index: number) => {
      selectProIndex(index)
    },
    [selectProIndex],
  )

  return {
    proDescriptors,
    hasProTypes,
    proSegmentLabel,
    activeProType,
    isProActive,
    isMenuOpen,
    activeIndex,
    triggerRef,
    listRef,
    listboxId,
    optionId,
    selectMarket,
    selectLimit,
    onTriggerClick,
    onTriggerKeyDown,
    onListKeyDown,
    onOptionClick,
  }
}
