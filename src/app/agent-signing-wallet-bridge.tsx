import { useEffect } from 'react'
import { useAgentWallet } from '@/modules/hyperliquid'
import { setAgentSigningWalletGetter } from './agent-signing-wallet-holder'

/**
 * Registers the agent signing-wallet getter from `AgentWalletProvider` into the
 * module-scope holder the (non-React) Hyperliquid venue factory reads through
 * `getCurrentAgentSigningWallet`. Mirrors `SpectateBridge` / the wallet-address
 * holder pattern: a React provider owns the value, an effect writes it into the
 * holder, and the venue reads it via a stable getter passed at construction —
 * so wallet rotation / agent approval never rebuilds the venue.
 *
 * **Security:** what is bridged is a *getter closure*, never the key. The
 * closure resolves the agent `AbstractWallet` lazily at signing time from the
 * provider's in-memory key ref; the private key never enters React state, the
 * holder, the venue, logs, or serialization. On unmount the getter is cleared so
 * the venue immediately reports "no signer" (the trader returns a typed error).
 */
export function AgentSigningWalletBridge() {
  const { getSigningWallet } = useAgentWallet()

  useEffect(() => {
    setAgentSigningWalletGetter(getSigningWallet)
    return () => setAgentSigningWalletGetter(null)
  }, [getSigningWallet])

  return null
}
