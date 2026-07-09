import { useCallback, useSyncExternalStore } from 'react'
import type { AccountModeReader } from '@/modules/shared/domain'
import { useIsSpectating } from '@/modules/spectate'
import { useVenueOptional } from '../../providers/venue-provider'
import { useTransferSheet } from '../../providers/transfer-sheet-provider'
import type { TransferTriggerContent } from './transfer-trigger.types'

/**
 * Smart hook for `<TransferTrigger>`. Combines three gates into one
 * `isTransferAvailable` fact (ADR-0033 D-4):
 *
 * 1. the active venue exposes a `transfer` capability,
 * 2. the account is segregated (`accountMode.isSegregated`) — Transfer is
 *    meaningless on a unified / portfolio-margin account, and
 * 3. the app is not spectating — Transfer signs with the connected wallet, never
 *    the Spectated Address (ADR-0021), so the affordance is hidden while viewing
 *    someone else's account (the mode-3 idiom; mirrors the dock's `canAct`).
 *
 * The mode is read straight from the venue's `accountMode` capability (not the
 * flow provider — the trigger lives outside it) via `useSyncExternalStore`,
 * defaulting to **segregated** (`true`) when no capability exists so a transient
 * read failure never strips a classic user of the affordance (the "absent
 * affordance" idiom of mode-3). Venue-agnostic.
 */
export function useTransferTrigger(): TransferTriggerContent {
  const venue = useVenueOptional()
  const { open } = useTransferSheet()
  const isSpectating = useIsSpectating()

  const accountModeCap = venue?.capabilities.accountMode ?? null
  const hasTransferCapability = venue?.transfer != null

  const isSegregated = useAccountSegregated(accountModeCap)

  const isTransferAvailable = hasTransferCapability && isSegregated && !isSpectating
  return { isTransferAvailable, onClick: () => open() }
}

/**
 * Subscribe to the venue's `accountMode` capability and read `isSegregated`.
 * `useSyncExternalStore` is the canonical external-subscription read — no
 * set-state-in-effect. Defaults to `true` (classic assumption) when the
 * capability is absent.
 */
function useAccountSegregated(accountMode: AccountModeReader | null): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!accountMode) return () => {}
      return accountMode.subscribe(() => onChange())
    },
    [accountMode],
  )
  const getSnapshot = useCallback(
    () => (accountMode ? accountMode.current().isSegregated : true),
    [accountMode],
  )
  return useSyncExternalStore(subscribe, getSnapshot)
}
