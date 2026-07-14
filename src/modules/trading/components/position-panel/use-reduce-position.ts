import { useCallback, useMemo, useState } from 'react'
import { useCapability } from '@/modules/shared/providers/venue-provider'
import { toast } from '@/modules/shared/services/toast'
import { generateCloid } from '@/modules/shared/utils/generate-cloid'
import { formatVenueErrorMessage } from '@/modules/shared/utils/format-venue-error-message'
import { ORDER_CLOID_PREFIX } from '@/modules/shared/constants/order.constants'
import type { PerpPositionSnapshot } from '@/modules/shared/domain'
import {
  buildLimitCloseRequest,
  buildMarketCloseRequest,
  clampCloseSize,
  closeSizeForFraction,
} from './position-close.utils'
import { parseTriggerInput } from './exit-target.utils'
import type { ReduceMode, UseReducePositionReturn } from './position-panel.types'

/**
 * Take part of the position off. The percent slider is the affordance that
 * matters: "close half" is a thing traders actually do, and making them compute
 * the coin size for it is how they fat-finger a full close instead.
 *
 * Market reduces now; limit rests a reduce-only order at your price. Both are
 * `reduceOnly`, so neither can accidentally flip you into the opposite side.
 */
export function useReducePosition(
  position: PerpPositionSnapshot,
  onDone: () => void,
): UseReducePositionReturn {
  const trader = useCapability('trader')
  const [mode, setMode] = useState<ReduceMode>('market')
  const [fraction, setFraction] = useState(0.5)
  const [limitPriceInput, setLimitPriceInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const openSize = Math.abs(position.size)

  const size = useMemo(
    () => clampCloseSize(closeSizeForFraction(fraction, position.size), position.size),
    [fraction, position.size],
  )

  const limitPrice = parseTriggerInput(limitPriceInput)
  const isLimit = mode === 'limit'
  const isPriceValid = !isLimit || limitPrice !== null

  const canSubmit = size > 0 && isPriceValid && !isSubmitting

  const useMarkPrice = useCallback(() => {
    setLimitPriceInput(String(position.markPrice))
  }, [position.markPrice])

  const submit = useCallback(() => {
    if (!canSubmit) return
    setIsSubmitting(true)

    const clientOrderId = generateCloid(ORDER_CLOID_PREFIX)
    const request =
      isLimit && limitPrice !== null
        ? buildLimitCloseRequest({ position, size, price: limitPrice, clientOrderId })
        : buildMarketCloseRequest({ position, size, clientOrderId })

    trader.placeOrder(request).match(
      () => {
        setIsSubmitting(false)
        const isFullClose = size >= openSize
        toast.show({
          variant: 'success',
          title: isFullClose ? 'Position closed' : 'Position reduced',
          description: position.symbol,
        })
        onDone()
      },
      (error) => {
        setIsSubmitting(false)
        toast.show({
          variant: 'error',
          title: 'Reduce failed',
          description: formatVenueErrorMessage(error.message),
        })
      },
    )
  }, [canSubmit, isLimit, limitPrice, position, size, openSize, trader, onDone])

  return {
    mode,
    setMode,
    fraction,
    setFraction,
    size,
    openSize,
    limitPriceInput,
    setLimitPriceInput,
    useMarkPrice,
    isPriceValid,
    canSubmit,
    isSubmitting,
    submit,
  }
}
