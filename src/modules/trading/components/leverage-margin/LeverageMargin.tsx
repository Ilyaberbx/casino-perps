import { useLeverageMargin } from '../../providers/leverage-margin'
import { LeverageSection } from './LeverageSection'

/**
 * Inline leverage section in the order ticket — a 'Leverage' label + editable
 * value chip + leverage slider, paired with the Cross/Isolated dropdown. Each
 * control narrows on its own capability (`leverageController` /
 * `marginModeController`); the whole section hides when neither is present.
 * Leverage is venue account state applied via a signed action on slider release
 * — the order request carries no leverage. (The modal that once held this
 * dissolved inline; margin mode was already its own dropdown.)
 */
export function LeverageMargin() {
  const {
    isAvailable,
    availability,
    symbol,
    leverage,
    marginMode,
    maxLeverage,
    isApplying,
    applyLeverage,
    applyMarginMode,
  } = useLeverageMargin()

  if (!isAvailable) return null

  return (
    <LeverageSection
      symbol={symbol}
      leverage={leverage}
      maxLeverage={maxLeverage}
      isApplying={isApplying}
      marginMode={marginMode}
      canEditLeverage={availability.hasLeverageController}
      canEditMarginMode={availability.hasMarginModeController}
      onApplyLeverage={applyLeverage}
      onApplyMarginMode={applyMarginMode}
    />
  )
}
