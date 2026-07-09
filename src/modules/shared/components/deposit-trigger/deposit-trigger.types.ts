import type { PixelButtonSize, PixelButtonVariant } from '../pixel-button'

export interface DepositTriggerProps {
  readonly variant?: PixelButtonVariant
  readonly size?: PixelButtonSize
  readonly fullWidth?: boolean
}

export interface DepositTriggerContent {
  /**
   * `true` when the active venue exposes an in-app `deposit` capability AND the
   * app is not spectating. Both must hold for the affordance to render;
   * otherwise the trigger is `null` (absent affordance).
   */
  readonly canDeposit: boolean
  onClick(): void
}
