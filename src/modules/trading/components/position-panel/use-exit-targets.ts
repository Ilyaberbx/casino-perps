import { useCallback, useMemo, useState } from 'react'
import { useCapabilityOptional } from '@/modules/shared/providers/venue-provider'
import { toast } from '@/modules/shared/services/toast'
import { formatVenueErrorMessage } from '@/modules/shared/utils/format-venue-error-message'
import type {
  PerpPositionSnapshot,
  PositionProtectionLegs,
  TriggerLeg,
} from '@/modules/shared/domain'
import { parseTriggerInput, roiPctFor, validateExitTargets } from './exit-target.utils'
import type { UseExitTargetsReturn } from './position-panel.types'

/**
 * Take-profit / stop-loss on an open position, with a live ROE preview per leg
 * and the three validations that make a stop a real stop: correct side of entry,
 * not past liquidation, and not crossed with the other leg.
 *
 * Uses the `positionProtection` capability (HL grouping `positionTpsl`), which
 * SCALES with the position — distinct from the entry-attached legs the order
 * ticket can send. Absent capability ⇒ `isSupported: false` and the action hides.
 */
export function useExitTargets(
  position: PerpPositionSnapshot,
  onDone: () => void,
): UseExitTargetsReturn {
  const protection = useCapabilityOptional('positionProtection')
  const [takeProfitInput, setTakeProfitInput] = useState('')
  const [stopLossInput, setStopLossInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  const takeProfit = parseTriggerInput(takeProfitInput)
  const stopLoss = parseTriggerInput(stopLossInput)

  const issues = useMemo(
    () => validateExitTargets(takeProfit, stopLoss, position),
    [takeProfit, stopLoss, position],
  )

  const hasAnyLeg = takeProfit !== null || stopLoss !== null
  const canSubmit = hasAnyLeg && issues.length === 0 && !isSubmitting

  const submit = useCallback(() => {
    if (!protection || !canSubmit) return
    setIsSubmitting(true)

    const legs: PositionProtectionLegs = {}
    if (takeProfit !== null) legs.takeProfit = leg('take-profit', takeProfit)
    if (stopLoss !== null) legs.stopLoss = leg('stop-loss', stopLoss)

    protection.setProtection(position.symbol, legs).match(
      () => {
        setIsSubmitting(false)
        toast.show({ variant: 'success', title: 'Exit targets set' })
        onDone()
      },
      (error) => {
        setIsSubmitting(false)
        toast.show({
          variant: 'error',
          title: 'Could not set exit targets',
          description: formatVenueErrorMessage(error.message),
        })
      },
    )
  }, [protection, canSubmit, takeProfit, stopLoss, position.symbol, onDone])

  const clear = useCallback(() => {
    if (!protection || isClearing) return
    setIsClearing(true)
    protection.clearProtection(position.symbol).match(
      () => {
        setIsClearing(false)
        toast.show({ variant: 'success', title: 'Exit targets removed' })
        onDone()
      },
      (error) => {
        setIsClearing(false)
        toast.show({
          variant: 'error',
          title: 'Could not remove exit targets',
          description: formatVenueErrorMessage(error.message),
        })
      },
    )
  }, [protection, isClearing, position.symbol, onDone])

  return {
    takeProfitInput,
    stopLossInput,
    setTakeProfitInput,
    setStopLossInput,
    takeProfitRoiPct: takeProfit === null ? null : roiPctFor(takeProfit, position),
    stopLossRoiPct: stopLoss === null ? null : roiPctFor(stopLoss, position),
    issues,
    canSubmit,
    isSubmitting,
    submit,
    clear,
    isClearing,
    isSupported: protection !== undefined,
  }
}

/** A market trigger at `price` — it closes the position when the price is hit,
 *  rather than resting a limit that might never fill in the move that triggered it. */
function leg(kind: TriggerLeg['kind'], price: number): TriggerLeg {
  return { kind, trigger: { type: 'price', price } }
}
