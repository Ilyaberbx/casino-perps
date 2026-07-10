import type { Market, OrderDraft, Side } from '@/modules/shared/domain'
import type {
  VenueOnboardingInputSpec,
  VenueOnboardingStep,
} from '@/modules/shared/domain/venue-onboarding'
import { formatPrice, specFromMarket } from '@/modules/shared/utils/format-price'
import type { BetDirection, ConfirmCta, ConfirmCtaInput } from './casino-trade.types'

/**
 * D18 — the chip value is MARGIN (what the user can lose). This converts that
 * margin into the coin position size the venue signs:
 *
 *   size = (betAmount × leverage) / markPrice
 *
 * snapped DOWN to the market's lot precision (`szDecimals`, recovered from the
 * market metadata via `specFromMarket`, never guessed) so the venue's lot-step
 * validator never rejects an otherwise-valid bet. A `$50` bet at `10×` with a
 * `$100` mark opens `5` coins of notional `$500` — the `$500` notional is never
 * shown to the user. Non-positive / non-finite inputs collapse to `0`.
 *
 * We floor rather than round because rounding UP spends more margin than the
 * user staked: at `szDecimals = 0` a `$50` bet at `10×` on a `$3` mark rounds
 * `166.67` up to `167` coins — `$501` notional, i.e. `$50.10` of margin from a
 * `$50` chip. On a MAX bet that is more margin than exists, and the venue
 * rejects the order. Flooring costs at most one lot step and can never
 * overspend. The chip is a promise: you cannot lose more than you staked (D18).
 */
export function marginToSize(
  betAmount: number,
  leverage: number,
  markPrice: number,
  szDecimals: number,
): number {
  const hasPositiveMargin = betAmount > 0
  const hasPositiveLeverage = leverage > 0
  const hasPositiveMark = markPrice > 0
  const hasValidLotPrecision = Number.isFinite(szDecimals) && szDecimals >= 0
  const isConvertible =
    hasPositiveMargin && hasPositiveLeverage && hasPositiveMark && hasValidLotPrecision
  if (!isConvertible) return 0
  const rawSize = (betAmount * leverage) / markPrice
  const lotFactor = 10 ** szDecimals
  return Math.floor(rawSize * lotFactor) / lotFactor
}

/** The lot precision (`szDecimals`) the venue expects for `market`. */
export function sizeLotDecimals(market: Market): number {
  return specFromMarket(market).szDecimals
}

/**
 * D16 — the liquidation price as a plain sentence, never a labelled number. An
 * UP (long) bet loses when the price *drops below* the liquidation; a DOWN
 * (short) bet loses when it *rises above*. The price is formatted with the
 * market's own precision and a `$` prefix (`$94,102`). A non-positive /
 * unknown liquidation degrades to a still-honest fallback sentence.
 */
export function formatLiquidationSentence(
  direction: BetDirection,
  liquidationPrice: number,
  market: Market,
): string {
  const ticker = market.baseAsset
  const hasLiquidation = Number.isFinite(liquidationPrice) && liquidationPrice > 0
  if (!hasLiquidation) return `You lose this bet if ${ticker} moves too far against you`
  const priceText = formatPrice(liquidationPrice, specFromMarket(market))
  const verb = direction === 'up' ? 'drops below' : 'rises above'
  return `You lose this bet if ${ticker} ${verb} $${priceText}`
}

/**
 * The confirm-sheet primary CTA (D6). Ordered by precedence: a disconnected
 * user connects first; a connected user with no balance adds cash; then the
 * in-flight setup / placing loaders; otherwise the bet is placeable.
 */
export function resolveConfirmCta(input: ConfirmCtaInput): ConfirmCta {
  if (!input.isConnected) return 'connect'
  if (!input.hasBalance) return 'add-cash'
  if (input.isSettingUp) return 'setting-up'
  if (input.isPlacing) return 'placing'
  return 'place-bet'
}

/** UP → buy (long), DOWN → sell (short). */
export function directionToSide(direction: BetDirection): Side {
  return direction === 'up' ? 'buy' : 'sell'
}

/** A long position is an UP bet; a short is a DOWN bet. */
export function positionSideToDirection(side: 'long' | 'short'): BetDirection {
  return side === 'long' ? 'up' : 'down'
}

/**
 * Build the venue-agnostic market-order draft for a bet. `sizeUnit: 'coin'`
 * carries the D18-converted size, so the placed size is exactly what
 * `marginToSize` produced (no re-conversion drift). Market IOC only (D17): no
 * limit price, no TIF surface, no reduce-only.
 */
export function buildBetDraft(input: {
  symbol: string
  direction: BetDirection
  size: number
  leverage: number
}): OrderDraft {
  return {
    symbol: input.symbol,
    orderType: 'market',
    side: directionToSide(input.direction),
    sizeUnit: 'coin',
    sizeInput: String(input.size),
    priceInput: '',
    stopPriceInput: '',
    slippageInput: '',
    timeInForce: 'Gtc',
    twapHoursInput: '',
    twapMinutesInput: '',
    randomize: false,
    reduceOnly: false,
    leverage: input.leverage,
  }
}

/** The default value for one onboarding input, or `null` when it has none. */
function onboardingInputDefault(input: VenueOnboardingInputSpec): string | null {
  switch (input.kind) {
    case 'text':
      return input.defaultValue ?? null
    case 'select':
      return input.options[0]?.value ?? null
    case 'checkbox':
      return input.required ? 'true' : null
  }
}

/**
 * D6 — the silent onboarding runs with no form: harvest every step input's own
 * default (the agent-name step already carries the derived default), so
 * `runAll` can be driven without ever rendering an "agent wallet" field.
 */
export function defaultOnboardingValues(
  steps: ReadonlyArray<VenueOnboardingStep>,
): Record<string, string> {
  const values: Record<string, string> = {}
  for (const step of steps) {
    const inputs = step.inputs ?? []
    for (const input of inputs) {
      const value = onboardingInputDefault(input)
      if (value !== null) values[input.id] = value
    }
  }
  return values
}
