import { useCallback, useState } from 'react'
import type { ModifyOrderRequest, Order } from '@/modules/shared/domain'
import type { UseModifyOrderDialogReturn } from './use-modify-order-dialog.types'

function parsePositive(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed.length === 0) return null
  const parsed = Number(trimmed)
  const isValid = Number.isFinite(parsed) && parsed > 0
  if (!isValid) return null
  return parsed
}

interface UseModifyOrderDialogArgs {
  order: Order
  onSubmit: (request: ModifyOrderRequest, symbol: string) => void
  onClose: () => void
}

/**
 * Owns the ModifyOrderDialog's prefilled price/size drafts. Builds a
 * `ModifyOrderRequest` carrying only the changed fields (HL `modify` falls back
 * to the resting order for the rest). Submit is blocked unless both fields are
 * positive and at least one differs from the resting order. Single consumer →
 * colocated with the dialog.
 */
export function useModifyOrderDialog({
  order,
  onSubmit,
  onClose,
}: UseModifyOrderDialogArgs): UseModifyOrderDialogReturn {
  const restingSize = order.originalSize ?? order.size
  const [priceInput, setPriceInput] = useState(String(order.price))
  const [sizeInput, setSizeInput] = useState(String(restingSize))

  const price = parsePositive(priceInput)
  const size = parsePositive(sizeInput)
  const areFieldsValid = price !== null && size !== null
  const isChanged = price !== order.price || size !== restingSize
  const canSubmit = areFieldsValid && isChanged

  const submit = useCallback(() => {
    if (price === null || size === null) return
    if (!isChanged) return
    onSubmit({ identifier: order.identifier, price, size }, order.symbol)
    onClose()
  }, [price, size, isChanged, order.identifier, order.symbol, onSubmit, onClose])

  return {
    priceInput,
    sizeInput,
    canSubmit,
    setPriceInput,
    setSizeInput,
    submit,
  }
}
