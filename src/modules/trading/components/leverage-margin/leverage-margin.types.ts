import type { MarginMode } from '@/modules/shared/domain'

/** Whether the venue exposes the leverage and/or margin-mode controllers. The
 *  whole section is hidden when neither is present (capability narrowing). */
export interface LeverageMarginAvailability {
  hasLeverageController: boolean
  hasMarginModeController: boolean
}

/** The leverage-margin smart hook's return — owns current state, the clamp
 *  ceiling, the in-flight flag, and the apply handlers. (Inline section: no
 *  dialog open/close state — the modal dissolved into the order ticket.) */
export interface UseLeverageMarginReturn {
  /** True when at least one controller is available — gates section rendering. */
  isAvailable: boolean
  availability: LeverageMarginAvailability
  /** Routing identity symbol for the selected market (`BTC-PERP`). */
  symbol: string
  /** Current leverage reflected on the chip + slider (seeded from the position,
   *  then reflects locally-applied changes after a successful set). */
  leverage: number
  marginMode: MarginMode
  /** Per-market clamp ceiling (market `maxLeverage`, fallback when absent). */
  maxLeverage: number
  /** True while a set-leverage or set-margin-mode action is in flight. */
  isApplying: boolean
  applyLeverage: (leverage: number) => void
  applyMarginMode: (mode: MarginMode) => void
}

/** The Cross/Isolated dropdown, sibling of the leverage chip. */
export interface MarginModeDropdownProps {
  marginMode: MarginMode
  onChange: (mode: MarginMode) => void
}

/** Props for the inline leverage section rendered in the order ticket. */
export interface LeverageSectionProps {
  symbol: string
  leverage: number
  maxLeverage: number
  isApplying: boolean
  marginMode: MarginMode
  /** Whether the venue exposes the leverage controller (gates the slider). */
  canEditLeverage: boolean
  /** Whether the venue exposes the margin-mode controller (gates the dropdown). */
  canEditMarginMode: boolean
  onApplyLeverage: (leverage: number) => void
  onApplyMarginMode: (mode: MarginMode) => void
}

export interface UseLeverageSliderArgs {
  leverage: number
  maxLeverage: number
  onApplyLeverage: (leverage: number) => void
}

export interface UseLeverageSliderReturn {
  /** Raw numeric-input value (string so the field can be cleared mid-edit). */
  draftInput: string
  /** The clamped integer leverage the slider reflects. */
  draftLeverage: number
  minLeverage: number
  setDraftInput: (value: string) => void
  setSliderLeverage: (value: number) => void
  /** Commit the draft via the signed set-leverage action (no-op if unchanged). */
  commitLeverage: () => void
}
