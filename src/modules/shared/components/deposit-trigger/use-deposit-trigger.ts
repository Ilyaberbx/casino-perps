import { useIsSpectating } from '@/modules/spectate'
import { useVenueOptional } from '../../providers/venue-provider'
import { useDepositSheet } from '../../providers/deposit-sheet-provider'
import type { DepositTriggerContent } from './deposit-trigger.types'

/**
 * Smart hook for `<DepositTrigger>`. Combines two gates into `canDeposit`:
 *
 * 1. the active venue exposes a `deposit` capability, and
 * 2. the app is not spectating — Deposit always credits the connected wallet's
 *    account (`primaryWalletAddress`, never the Spectated Address; ADR-0021), so
 *    the affordance is hidden while viewing someone else's account rather than
 *    presenting a deposit framed against the wrong account (the mode-3 idiom).
 *
 * Venue-agnostic: it only learns *whether* a deposit flow exists, never anything
 * about it.
 */
export function useDepositTrigger(): DepositTriggerContent {
  const venue = useVenueOptional()
  const { open } = useDepositSheet()
  const isSpectating = useIsSpectating()

  const hasDepositCapability = venue?.deposit != null
  return { canDeposit: hasDepositCapability && !isSpectating, onClick: open }
}
