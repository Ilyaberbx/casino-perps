export const DEFAULT_SIZE = '' as const
export const DEFAULT_PRICE = '' as const

// Ctrl+X exits spectating from order entry. Compared lowercase against `KeyboardEvent.key`.
export const STOP_SPECTATING_HOTKEY = 'x' as const

// Pending order toast stays up until the terminal outcome replaces it in place
// (keyed by cloid). Long enough to outlast any expected ack/network latency;
// the terminal toast (`show` with the same id) supersedes it.
export const ORDER_PENDING_TOAST_DURATION_MS = 60_000

// Cloid prefix the trading layer stamps onto every order it submits, so the
// pending toast can be keyed by the same cloid that is threaded into the
// request. `trading/` is venue-agnostic and must not import a venue module
// (incl. `hyperliquid.constants.ts`), so the prefix is owned here. The venue
// adapter respects the threaded `clientOrderId`; PRD decision 7's
// hyperliquid-constants prefix is the adapter's own fallback when none is set.
export const ORDER_CLOID_PREFIX = 'a99a' as const

// Buying-power chips: each value is the fraction of buying power the chip sizes
// the order to (25 / 50 / 75 / 100%). PRD decision 8.
export const BUYING_POWER_CHIP_FRACTIONS = [0.25, 0.5, 0.75, 1] as const

// Amount % slider tick notches (0–100 scale): the quarter stops. 0 and 100
// carry captions; 25/50/75 draw as bare notches.
export const AMOUNT_SLIDER_TICKS: ReadonlyArray<PixelSliderTick> = [
  { value: 0, label: '0%' },
  { value: 25 },
  { value: 50 },
  { value: 75 },
  { value: 100, label: '100%' },
]

// Time-in-force options for limit orders (matches trade.xyz's TIF selector).
// Gtc = good-til-cancelled, Ioc = immediate-or-cancel, Alo = add-liquidity-only
// (post-only). Mirrors the domain `OrderTimeInForce` union.
export const TIF_OPTIONS = [
  { value: 'Gtc', label: 'GTC' },
  { value: 'Ioc', label: 'IOC' },
  { value: 'Alo', label: 'ALO' },
] as const

// Legal disclaimer shown below the pre-trade summary for every order type
// (IA panel hierarchy row 12). Split into prefix / link label / suffix so the
// "Terms of Use" phrase renders as a real link to the canonical landing page
// (tradingConfig.termsUrl) — see ADR-0075.
export const ORDER_DISCLAIMER_PREFIX = 'By submitting this trade, you agree to our ' as const
export const ORDER_DISCLAIMER_LINK_LABEL = 'Terms of Use' as const
export const ORDER_DISCLAIMER_SUFFIX =
  ' and attest that you are not trading from a restricted territory.' as const

// TWAP running-time defaults: 0h / 30m (IA "switch type mid-edit" flow).
export const DEFAULT_TWAP_HOURS = '0' as const
export const DEFAULT_TWAP_MINUTES = '30' as const

import type { EntryProtectionDraft, ProTypeDescriptor } from './order-entry.types'
import type { PixelSliderTick } from '@/modules/shared/components/pixel-slider'

// The Pro (advanced) order types, in the reference dropdown order: TWAP, Stop
// Limit, Stop Market (IA "Order-type control & field-switching model"). Each
// carries the capability flag that must be set for it to appear in the menu.
// `Stop Limit`/`Stop Market` both gate on `supportsStopOrders`; `TWAP` gates on
// `supportsTwap`.
export const PRO_TYPE_DESCRIPTORS: ReadonlyArray<ProTypeDescriptor> = [
  { value: 'twap', label: 'TWAP', flag: 'supportsTwap' },
  { value: 'stop-limit', label: 'Stop Limit', flag: 'supportsStopOrders' },
  { value: 'stop-market', label: 'Stop Market', flag: 'supportsStopOrders' },
] as const

// Label shown on the 3rd segment when no Pro type is active.
export const PRO_SEGMENT_DEFAULT_LABEL = 'Pro' as const

// Entry-attached TP/SL defaults (2×2 reference shape): section off, $ basis,
// empty price/amount on both legs. The section is collapsed by default
// (progressive disclosure — PRD principle 2).
export const INITIAL_ENTRY_PROTECTION: EntryProtectionDraft = {
  enabled: false,
  basis: 'usd',
  takeProfit: { priceInput: '', amountInput: '' },
  stopLoss: { priceInput: '', amountInput: '' },
}

/** Simple ticket — the price-target (limit) toggle label and the review sheet's title. */
export const PRICE_TARGET_LABEL = 'Price target'
export const REVIEW_SHEET_TITLE = 'Review order'
