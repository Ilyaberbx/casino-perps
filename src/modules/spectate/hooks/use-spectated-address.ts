import { useContext } from 'react'
import type { WalletAddress } from '@/modules/shared/domain'
import { SpectateContext } from '../providers/spectate-provider/spectate-provider.context'

// Returns the active Spectated Address, or null when not spectating.
//
// Reads the context directly (not via useSpectate, which throws) so it is inert
// — returning null — when no SpectateProvider is mounted. Mirrors useSpectateLink
// / SpectateBanner, keeping isolated consumer tests provider-free. Consumers use
// it as a reload key: a change means a new account is in view (see AccountDock).
export function useSpectatedAddress(): WalletAddress | null {
  const spectate = useContext(SpectateContext)
  return spectate?.spectatedAddress ?? null
}
