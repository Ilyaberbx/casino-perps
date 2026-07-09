import { useContext } from 'react'
import { SpectateContext } from '../providers/spectate-provider/spectate-provider.context'

// Returns whether a spectate session is active, or false when not spectating.
//
// Reads the context directly (not via useSpectate, which throws) so it is inert
// — returning false — when no SpectateProvider is mounted. Mirrors
// useSpectatedAddress / useSpectateLink, keeping isolated consumer tests
// provider-free. Money affordances (Transfer/Deposit triggers) gate on it so
// the button is hidden while the app is re-keyed to a Spectated Address — those
// flows sign with the connected wallet, never the spectated one (ADR-0021), so
// acting while spectating would move the User's own funds from someone else's
// account view. Hiding the affordance is the mode-3 idiom (`wallet-gate.md`).
export function useIsSpectating(): boolean {
  const spectate = useContext(SpectateContext)
  return spectate?.isSpectating ?? false
}
