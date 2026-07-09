import { useEffect } from 'react'
import { useSelectedWallet, useAuth } from '@/modules/account'
import { useVenueOptional } from '@/modules/shared/providers/venue-provider'
import { setConnectedWalletAddress } from './wallet-address-holder'

/**
 * Writes the **Viewing Address** for the Hyperliquid data/observation layer into
 * the wallet-address holder, re-keyed to the **Selected Wallet** (PRD-0006), and
 * asks the venue to re-subscribe its live streams to it.
 *
 * The viewing address is `selectedAddress ?? primaryWalletAddress`: the
 * server-stored Selected Wallet drives the data surfaces, falling back to the
 * Privy-canonical wallet when there is no stored selection. The read is
 * read-only, so connectability is irrelevant here — an imported selection
 * renders its Hyperliquid account even when it is not currently connected to
 * sign (`isSelectionConnectable` is not consulted).
 *
 * Why this re-keys BOTH the data AND the order flow: the holder's
 * `connectedAddress` feeds the Viewing Address (`getCurrentWalletAddress` =
 * `spectate ?? connected`) AND the Acting Address (`getActingWalletAddress` =
 * `connected`). So writing it here re-keys the observation surfaces (Portfolio,
 * account dock) via `refreshAddress()` and the order flow (validation / preview
 * / leverage / fees) via `refreshActingAddress()`. Spectate still overrides the
 * Viewing Address only — `SpectateBridge` writes `spectatedAddress` and calls
 * `refreshAddress()` alone, never re-keying the acting streams (ADR-0021 /
 * ADR-0038).
 *
 * This bridge replaces the Native (Primary Wallet) address mirroring that used
 * to live in `useVenueSession` — which sat above the account session and could
 * not read `useSelectedWallet` (it needs `useOnboardingFlow`). Mounting the
 * bridge deep in the tree (inside `OnboardingFlowProvider` + the venue scope)
 * gives it access to the Selected Wallet. The effect depends on `venue`, so a
 * venue rebuild (venueId switch / reconnect) re-mirrors the address into the
 * fresh venue's closure.
 */
export function SelectedWalletBridge() {
  const { selectedAddress } = useSelectedWallet()
  const { primaryWalletAddress } = useAuth()
  const venue = useVenueOptional()

  const viewingAddress = selectedAddress ?? primaryWalletAddress

  useEffect(() => {
    setConnectedWalletAddress(viewingAddress)
    venue?.refreshAddress?.()
    venue?.refreshActingAddress?.()
  }, [viewingAddress, venue])

  return null
}
