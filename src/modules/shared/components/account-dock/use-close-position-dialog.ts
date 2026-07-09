import { useCallback, useState } from 'react'
import { generateCloid } from '@/modules/shared/utils/generate-cloid'
import { ORDER_CLOID_PREFIX } from '@/modules/shared/constants/order.constants'
import type { PerpPositionSnapshot, PlaceOrderRequest } from '@/modules/shared/domain'
import {
  buildLimitCloseRequest,
  buildMarketCloseRequest,
  clampCloseSize,
  closeSizeForFraction,
} from './close-position.utils'
import type { CloseKind, CloseSizeBasis } from './account-dock.types'
import type { UseClosePositionDialogReturn } from './use-close-position-dialog.types'

function parsePositive(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed.length === 0) return null
  const parsed = Number(trimmed)
  const isValid = Number.isFinite(parsed) && parsed > 0
  if (!isValid) return null
  return parsed
}

interface UseClosePositionDialogArgs {
  position: PerpPositionSnapshot | null
  onSubmit: (request: PlaceOrderRequest) => void
  onClose: () => void
}

/**
 * Owns the ClosePositionDialog's draft: close kind (partial market vs limit),
 * size basis (coin / % of position), the size + limit-price inputs. Builds a
 * reduce-only close request and forwards it to `onSubmit`, then closes. Single
 * consumer → colocated with the dialog.
 */
export function useClosePositionDialog({
  position,
  onSubmit,
  onClose,
}: UseClosePositionDialogArgs): UseClosePositionDialogReturn {
  const [kind, setKind] = useState<CloseKind>('partial')
  const [sizeBasis, setSizeBasis] = useState<CloseSizeBasis>('percent')
  const [sizeInput, setSizeInput] = useState('')
  const [priceInput, setPriceInput] = useState('')

  const resolvedSize = (() => {
    if (position === null) return 0
    const value = parsePositive(sizeInput)
    if (value === null) return 0
    const requested =
      sizeBasis === 'percent' ? closeSizeForFraction(value / 100, position.size) : value
    return clampCloseSize(requested, position.size)
  })()

  const isLimit = kind === 'limit'
  const limitPrice = parsePositive(priceInput)
  const isPriceValid = !isLimit || limitPrice !== null
  const isSizeValid = resolvedSize > 0
  const canSubmit = isSizeValid && isPriceValid

  const submit = useCallback(() => {
    if (position === null) return
    if (!canSubmit) return
    const clientOrderId = generateCloid(ORDER_CLOID_PREFIX)
    const request =
      isLimit && limitPrice !== null
        ? buildLimitCloseRequest({ position, size: resolvedSize, price: limitPrice, clientOrderId })
        : buildMarketCloseRequest({ position, size: resolvedSize, clientOrderId })
    onSubmit(request)
    onClose()
  }, [position, canSubmit, isLimit, limitPrice, resolvedSize, onSubmit, onClose])

  return {
    kind,
    sizeBasis,
    sizeInput,
    priceInput,
    resolvedSize,
    isSizeValid,
    isPriceValid,
    canSubmit,
    setKind,
    setSizeBasis,
    setSizeInput,
    setPriceInput,
    submit,
  }
}
