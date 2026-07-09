import { FALLBACK_MAX_LEVERAGE, LEVERAGE_NOTCHES, MIN_LEVERAGE } from './leverage-margin.constants'
import type { PixelSliderTick } from '@/modules/shared/components/pixel-slider'

/** Resolve the per-market clamp ceiling. A market's `maxLeverage` wins when
 *  present and ≥ the floor; otherwise the shared fallback applies. */
export function resolveMaxLeverage(marketMaxLeverage: number | undefined): number {
  const hasMarketMax = marketMaxLeverage !== undefined && marketMaxLeverage >= MIN_LEVERAGE
  if (!hasMarketMax) return FALLBACK_MAX_LEVERAGE
  return marketMaxLeverage
}

/**
 * Builds the leverage slider's tick notches (LOCKED DECISION b): the notable
 * integers `1 / 5 / 10 / 20` that fall strictly below the per-market ceiling,
 * plus the ceiling itself. So a 40× market reads `1 5 10 20 40`, a 10× market
 * reads `1 5 10`, and a 3× market reads `1 3`. Only `1×` and `max×` carry
 * captions to keep the scale legible; the interior notches draw as bare marks.
 */
export function buildLeverageTicks(maxLeverage: number): PixelSliderTick[] {
  const interior = LEVERAGE_NOTCHES.filter((notch) => notch > MIN_LEVERAGE && notch < maxLeverage)
  const values = [MIN_LEVERAGE, ...interior, maxLeverage]
  return values.map((value) => {
    const isEndpoint = value === MIN_LEVERAGE || value === maxLeverage
    return isEndpoint ? { value, label: `${value}×` } : { value }
  })
}

/** Clamp a requested leverage to `[MIN_LEVERAGE, maxLeverage]` and round to an
 *  integer — venues (HL) require integer leverage. */
export function clampLeverage(requested: number, maxLeverage: number): number {
  const isInvalid = !Number.isFinite(requested)
  if (isInvalid) return MIN_LEVERAGE
  const rounded = Math.round(requested)
  const belowFloor = rounded < MIN_LEVERAGE
  if (belowFloor) return MIN_LEVERAGE
  const aboveCeiling = rounded > maxLeverage
  if (aboveCeiling) return maxLeverage
  return rounded
}
