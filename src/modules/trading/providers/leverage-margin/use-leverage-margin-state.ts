import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCapabilityOptional, useOwnCapability } from '@/modules/shared/providers/venue-provider'
import { toast } from '@/modules/shared/services/toast'
import type { MarginMode, PerpPositionSnapshot } from '@/modules/shared/domain'
import { useSelectedMarketContext } from '../selected-market-provider'
import {
  DEFAULT_LEVERAGE,
  DEFAULT_MARGIN_MODE,
} from '../../components/leverage-margin/leverage-margin.constants'
import { resolveMaxLeverage } from '../../components/leverage-margin/leverage-margin.utils'
import {
  buildLeverageAppliedToast,
  buildLeverageErrorToast,
  buildMarginModeAppliedToast,
  buildMarginModeErrorToast,
} from '../../components/leverage-margin/leverage-margin-toast.utils'
import type { UseLeverageMarginReturn } from '../../components/leverage-margin/leverage-margin.types'

/**
 * Builds the shared leverage + margin-mode state for the selected market. Owns
 * the inline section's current state and the apply-on-change handlers. Mounted
 * ONCE by `LeverageMarginProvider`; both the inline `LeverageMargin` section and
 * `use-order-entry` consume the result via `useLeverageMargin()` so they share a
 * single source of truth (a flat-account leverage set in the section must reach
 * order entry — otherwise the pre-trade estimates size at 1×).
 *
 * Current state is seeded from the live perps-positions snapshot for the
 * selected market (the only venue-agnostic source of current leverage/margin),
 * falling back to 1×/cross, and reflects locally-applied changes after a
 * successful signed `setLeverage` / `setMarginMode` (the venue is still the
 * source of truth — the stream reconciles the seed on the next tick).
 */
export function useLeverageMarginState(): UseLeverageMarginReturn {
  const leverageControllerCap = useCapabilityOptional('leverageController')
  const marginModeControllerCap = useCapabilityOptional('marginModeController')
  // Seed the leverage/margin-mode state from the ACTING positions snapshot:
  // setLeverage/setMarginMode sign against the User's own account, so the
  // displayed seed must be self too, not the Spectated Address's (ADR-0038 D-1).
  const positionsSnapshotCap = useOwnCapability('perpsPositionsSnapshot')
  const { selectedMarket, market } = useSelectedMarketContext()

  const [snapshotLeverage, setSnapshotLeverage] = useState<number | null>(null)
  const [snapshotMarginMode, setSnapshotMarginMode] = useState<MarginMode | null>(null)
  const [appliedLeverage, setAppliedLeverage] = useState<number | null>(null)
  const [appliedMarginMode, setAppliedMarginMode] = useState<MarginMode | null>(null)
  const [isApplying, setIsApplying] = useState(false)

  // Reset locally-applied overrides when the market changes — they belong to a
  // single symbol; the snapshot reseeds for the new market. Render-time
  // previous-symbol tracker (React 19 idiom; the compiler forbids setState in
  // an effect).
  const [previousSymbol, setPreviousSymbol] = useState(selectedMarket)
  const hasSymbolChanged = previousSymbol !== selectedMarket
  if (hasSymbolChanged) {
    setPreviousSymbol(selectedMarket)
    setAppliedLeverage(null)
    setAppliedMarginMode(null)
  }

  useEffect(() => {
    if (!positionsSnapshotCap) return
    return positionsSnapshotCap.subscribe((positions: ReadonlyArray<PerpPositionSnapshot>) => {
      const position = positions.find((entry) => entry.symbol === selectedMarket)
      setSnapshotLeverage(position ? position.leverage : null)
      setSnapshotMarginMode(position ? position.leverageType : null)
    })
  }, [positionsSnapshotCap, selectedMarket])

  const hasLeverageController = leverageControllerCap !== undefined
  const hasMarginModeController = marginModeControllerCap !== undefined
  const isAvailable = hasLeverageController || hasMarginModeController

  const maxLeverage = useMemo(() => resolveMaxLeverage(market.maxLeverage), [market.maxLeverage])
  const leverage = appliedLeverage ?? snapshotLeverage ?? DEFAULT_LEVERAGE
  const marginMode = appliedMarginMode ?? snapshotMarginMode ?? DEFAULT_MARGIN_MODE

  const applyLeverage = useCallback(
    (nextLeverage: number) => {
      if (!leverageControllerCap) return
      if (isApplying) return
      setIsApplying(true)
      leverageControllerCap.setLeverage(selectedMarket, nextLeverage).match(
        () => {
          setIsApplying(false)
          setAppliedLeverage(nextLeverage)
          toast.show(buildLeverageAppliedToast(selectedMarket, nextLeverage))
        },
        (error) => {
          setIsApplying(false)
          toast.show(buildLeverageErrorToast(error))
        },
      )
    },
    [leverageControllerCap, isApplying, selectedMarket],
  )

  const applyMarginMode = useCallback(
    (mode: MarginMode) => {
      if (!marginModeControllerCap) return
      if (isApplying) return
      setIsApplying(true)
      marginModeControllerCap.setMarginMode(selectedMarket, mode).match(
        () => {
          setIsApplying(false)
          setAppliedMarginMode(mode)
          toast.show(buildMarginModeAppliedToast(selectedMarket, mode))
        },
        (error) => {
          setIsApplying(false)
          toast.show(buildMarginModeErrorToast(error))
        },
      )
    },
    [marginModeControllerCap, isApplying, selectedMarket],
  )

  return {
    isAvailable,
    availability: { hasLeverageController, hasMarginModeController },
    symbol: selectedMarket,
    leverage,
    marginMode,
    maxLeverage,
    isApplying,
    applyLeverage,
    applyMarginMode,
  }
}
