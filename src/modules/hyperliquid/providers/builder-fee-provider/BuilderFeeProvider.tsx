import { useMemo, type ReactNode } from 'react'
import { logger } from '@/app/logger'
import { loadHyperliquidConfig } from '../../hyperliquid.config'
import { createNktkasHyperliquidExchangeGateway } from '../../gateway/nktkas-hyperliquid-exchange-gateway'
import { BuilderFeeContext } from './builder-fee-provider.context'
import { useOwnBuilderFee } from './use-builder-fee'

// Load Hyperliquid config once at module init — mirrors AgentWalletProvider.
const configResult = loadHyperliquidConfig(import.meta.env as Record<string, string | undefined>)
const isTestnet = configResult.isOk() ? configResult.value.network === 'testnet' : false

/**
 * BuilderFeeProvider owns the builder-fee approval status against the partner
 * builder address (HYPERLIQUID_BUILDER_ADDRESS) for the current master wallet.
 * Constructs its own exchange gateway internally — mirrors AgentWalletProvider.
 *
 * Mount as a child of AgentWalletProvider in AccountSessionRoot so the
 * bundled-signing UX (agent then builder fee) reads from both contexts.
 */
export function BuilderFeeProvider({ children }: { children: ReactNode }) {
  const exchangeGateway = useMemo(
    () =>
      createNktkasHyperliquidExchangeGateway({
        isTestnet,
        logger,
      }),
    [],
  )

  const state = useOwnBuilderFee(exchangeGateway)

  return (
    <BuilderFeeContext.Provider value={state}>
      {children}
    </BuilderFeeContext.Provider>
  )
}
