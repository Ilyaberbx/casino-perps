import { useMemo, type ReactNode } from 'react'
import { logger } from '@/app/logger'
import { loadHyperliquidConfig } from '../../hyperliquid.config'
import { createNktkasHyperliquidExchangeGateway } from '../../gateway/nktkas-hyperliquid-exchange-gateway'
import { AgentWalletContext } from './agent-wallet-provider.context'
import { useOwnAgentWallet } from './use-agent-wallet'

// Load Hyperliquid config once at module init — same pattern as app/venues.ts
const configResult = loadHyperliquidConfig(import.meta.env as Record<string, string | undefined>)
const isTestnet = configResult.isOk() ? configResult.value.network === 'testnet' : false
const network = configResult.isOk() ? configResult.value.network : 'mainnet'

/**
 * AgentWalletProvider owns the agent wallet status, keypair, and approval flow.
 * Constructs its own exchange gateway internally — no gateway prop (mirrors OnboardingFlowProvider).
 * Must be mounted inside OnboardingFlowProvider so useOnboardingFlow() is available.
 */
export function AgentWalletProvider({ children }: { children: ReactNode }) {
  // Construct the gateway once — stable across renders (not rebuilt on re-render)
  const exchangeGateway = useMemo(
    () =>
      createNktkasHyperliquidExchangeGateway({
        isTestnet,
        logger,
      }),
    [],
  )

  const state = useOwnAgentWallet(exchangeGateway, network, logger)

  return (
    <AgentWalletContext.Provider value={state}>
      {children}
    </AgentWalletContext.Provider>
  )
}
