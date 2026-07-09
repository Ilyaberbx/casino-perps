import { useCallback, useMemo, useState } from 'react'
import {
  coupleFromAmountInput,
  coupleFromPriceInput,
  reprojectLegToBasis,
  triggerKindFor,
} from '@/modules/shared/utils/protection-coupling'
import type {
  DeriveTriggerContext,
  ProtectionBasis,
  ProtectionLegDraft,
  ProtectionLegKind,
} from '@/modules/shared/utils/protection-coupling.types'
import { buildPositionTpslLegs, positionReferenceSide, projectPositionTpslOrders } from './position-tpsl.utils'
import type {
  PositionTpslLegState,
  PositionTpslTab,
  UsePositionTpslArgs,
  UsePositionTpslReturn,
} from './position-tpsl.types'

const EMPTY_DRAFT: ProtectionLegDraft = { priceInput: '', amountInput: '' }
const INITIAL_LEG: PositionTpslLegState = { draft: EMPTY_DRAFT, basis: 'usd' }

function parsePositive(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed.length === 0) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

/**
 * Owns the Position TP/SL modal's full state (trade.xyz "Position TP/SL"):
 * the TP + SL leg drafts with independent $/% basis toggles (coupled price ⇄
 * gain/loss off entry), the Configure-Amount block (on/off + amount + slider
 * fraction of position size), the Limit-Price block (on/off + value), and the
 * Create/Orders tab. Submit builds `PositionProtectionLegs` (with `size` /
 * `limitPrice` only when the user opted in — ADR-0054 D-5) and forwards to
 * `onSubmit`; the Orders tab lists resting reduce-only trigger orders for the
 * symbol and cancels through `onCancelOrder`. Single consumer → colocated.
 */
export function usePositionTpsl({
  position,
  restingOrders,
  onSubmit,
  onCancelOrder,
  onClose,
}: UsePositionTpslArgs): UsePositionTpslReturn {
  const [activeTab, setActiveTab] = useState<PositionTpslTab>('create')
  const [takeProfit, setTakeProfit] = useState<PositionTpslLegState>(INITIAL_LEG)
  const [stopLoss, setStopLoss] = useState<PositionTpslLegState>(INITIAL_LEG)
  const [configureAmount, setConfigureAmount] = useState(false)
  const [amountInput, setAmountInput] = useState('')
  const [limitPriceEnabled, setLimitPriceEnabled] = useState(false)
  const [limitPriceInput, setLimitPriceInput] = useState('')

  const positionSize = Math.abs(position.size)
  const referenceSide = positionReferenceSide(position.side)

  const contextFor = useCallback(
    (legKind: ProtectionLegKind, basis: ProtectionBasis): DeriveTriggerContext => ({
      kind: triggerKindFor(legKind),
      basis,
      side: referenceSide,
      referencePrice: position.entryPrice,
      size: positionSize,
    }),
    [referenceSide, position.entryPrice, positionSize],
  )

  const legSetterFor = useCallback(
    (legKind: ProtectionLegKind) =>
      legKind === 'takeProfit' ? setTakeProfit : setStopLoss,
    [],
  )

  const setLegPrice = useCallback(
    (legKind: ProtectionLegKind, priceInput: string) => {
      const setter = legSetterFor(legKind)
      setter((previous) => ({
        ...previous,
        draft: coupleFromPriceInput(priceInput, contextFor(legKind, previous.basis)),
      }))
    },
    [legSetterFor, contextFor],
  )

  const setLegAmount = useCallback(
    (legKind: ProtectionLegKind, nextAmountInput: string) => {
      const setter = legSetterFor(legKind)
      setter((previous) => ({
        ...previous,
        draft: coupleFromAmountInput(nextAmountInput, contextFor(legKind, previous.basis)),
      }))
    },
    [legSetterFor, contextFor],
  )

  const setLegBasis = useCallback(
    (legKind: ProtectionLegKind, basis: ProtectionBasis) => {
      const setter = legSetterFor(legKind)
      setter((previous) => ({
        basis,
        draft: reprojectLegToBasis(
          previous.draft,
          {
            kind: triggerKindFor(legKind),
            side: referenceSide,
            referencePrice: position.entryPrice,
            size: positionSize,
          },
          basis,
        ),
      }))
    },
    [legSetterFor, referenceSide, position.entryPrice, positionSize],
  )

  const setAmountFraction = useCallback(
    (fraction: number) => {
      const clamped = Math.min(Math.max(fraction, 0), 1)
      setAmountInput(String(positionSize * clamped))
    },
    [positionSize],
  )

  const setAmountToMax = useCallback(() => {
    setAmountInput(String(positionSize))
  }, [positionSize])

  const amountFraction = useMemo(() => {
    const amount = parsePositive(amountInput)
    if (amount === null || positionSize <= 0) return 0
    return Math.min(amount / positionSize, 1)
  }, [amountInput, positionSize])

  const submitSize = useMemo(() => {
    if (!configureAmount) return undefined
    return parsePositive(amountInput) ?? undefined
  }, [configureAmount, amountInput])

  const submitLimitPrice = useMemo(() => {
    if (!limitPriceEnabled) return undefined
    return parsePositive(limitPriceInput) ?? undefined
  }, [limitPriceEnabled, limitPriceInput])

  const legs = useMemo(
    () =>
      buildPositionTpslLegs({
        position,
        takeProfit,
        stopLoss,
        size: submitSize,
        limitPrice: submitLimitPrice,
      }),
    [position, takeProfit, stopLoss, submitSize, submitLimitPrice],
  )

  const canSubmit = legs !== null

  const submit = useCallback(() => {
    if (legs === null) return
    onSubmit(position.symbol, legs)
    onClose()
  }, [legs, position.symbol, onSubmit, onClose])

  const cancelOrder = useCallback(
    (identifier: string) => {
      onCancelOrder(identifier)
    },
    [onCancelOrder],
  )

  const orderRows = useMemo(
    () => projectPositionTpslOrders(restingOrders, position),
    [restingOrders, position],
  )

  return {
    activeTab,
    setActiveTab,
    takeProfit,
    stopLoss,
    configureAmount,
    setConfigureAmount,
    amountInput,
    setAmountInput,
    amountFraction,
    setAmountFraction,
    setAmountToMax,
    limitPriceEnabled,
    setLimitPriceEnabled,
    limitPriceInput,
    setLimitPriceInput,
    setLegPrice,
    setLegAmount,
    setLegBasis,
    orderRows,
    canSubmit,
    submit,
    cancelOrder,
  }
}
