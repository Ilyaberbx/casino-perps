import { useCallback } from 'react'
import { useVenueOptional } from '../../providers/venue-provider'
import { useManageFunds, DEFAULT_MANAGE_FUNDS_TAB } from '../../providers/manage-funds-provider'
import { useIsSimpleMode } from '../../providers/trading-mode-provider'
import { toast } from '../../services/toast'
import { useIsSpectating } from '@/modules/spectate'
import { MANAGE_FUNDS_PILLS, SPECTATE_FUNDS_TOAST_TITLE, SPECTATE_FUNDS_TOAST_DESCRIPTION } from './manage-funds-pills.constants'
import type { ManageFundsTab } from '../../providers/manage-funds-provider'
import type { ManageFundsPillsContent } from './manage-funds-pills.types'

/**
 * Smart hook for `<ManageFundsPills>`. Reads the Manage Funds open controller
 * (`useManageFunds`), the active venue (`useVenueOptional`), and the global
 * Trading Mode (`useIsSimpleMode`). The whole row is gated on `hasAnyCapability`
 * — the venue must expose at least one of deposit / transfer / withdraw,
 * otherwise there is no money-movement surface to open and the row renders
 * nothing. In Simple mode the row collapses to a single "Manage Funds" button
 * that deep-links the default tab (#272); in Pro it stays the five-pill row.
 * Each pill / the button deep-links its tab via `open(tab)`. Venue-agnostic: it
 * only learns *whether* any flow exists.
 *
 * `onOpen` toast-blocks while Spectating instead of opening the modal — Manage
 * Funds always acts on the connected wallet, never the Spectated Address, so
 * opening it mid-spectate would show someone else's balances as your own
 * withdraw/send/transfer caps. Mirrors trade-equity-card's `onOpenFunds` guard
 * (ADR-0072); this was the one Manage Funds entry point that didn't have it.
 */
export function useManageFundsPills(): ManageFundsPillsContent {
  const venue = useVenueOptional()
  const { open } = useManageFunds()
  const isSimple = useIsSimpleMode()
  const isSpectating = useIsSpectating()

  const hasDeposit = venue?.deposit != null
  const hasTransfer = venue?.transfer != null
  const hasWithdraw = venue?.withdraw != null
  const hasAnyCapability = hasDeposit || hasTransfer || hasWithdraw

  const onOpen = useCallback(
    (tab: ManageFundsTab) => {
      if (isSpectating) {
        toast.show({
          variant: 'info',
          title: SPECTATE_FUNDS_TOAST_TITLE,
          description: SPECTATE_FUNDS_TOAST_DESCRIPTION,
        })
        return
      }
      open(tab)
    },
    [isSpectating, open],
  )

  return {
    hasAnyCapability,
    isSimple,
    pills: MANAGE_FUNDS_PILLS,
    simpleTab: DEFAULT_MANAGE_FUNDS_TAB,
    onOpen,
  }
}
