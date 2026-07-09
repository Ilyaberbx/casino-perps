import type { PixelButtonSize, PixelButtonVariant } from '../pixel-button'

export interface TransferTriggerProps {
  readonly variant?: PixelButtonVariant
  readonly size?: PixelButtonSize
  readonly fullWidth?: boolean
}

export interface TransferTriggerContent {
  /**
   * `true` when the active venue exposes an in-app `transfer` capability AND the
   * account is segregated (`accountMode.isSegregated`). Both must hold for the
   * affordance to render; otherwise the trigger is `null` (absent affordance).
   */
  readonly isTransferAvailable: boolean
  onClick(): void
}
