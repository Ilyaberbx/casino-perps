import { useMemo, type ReactNode } from 'react'
import { logger } from '@/app/logger'
import { loadHyperliquidConfig } from '../../hyperliquid.config'
import { createNktkasHyperliquidExchangeGateway } from '../../gateway/nktkas-hyperliquid-exchange-gateway'
import { Hip3AbstractionContext } from './hip3-abstraction-provider.context'
import { useOwnHip3Abstraction } from './use-hip3-abstraction'

// Load Hyperliquid config once at module init — mirrors BuilderFeeProvider.
const configResult = loadHyperliquidConfig(import.meta.env as Record<string, string | undefined>)
const isTestnet = configResult.isOk() ? configResult.value.network === 'testnet' : false

/**
 * Hip3AbstractionProvider owns the HIP-3 DEX-abstraction status + `enable`
 * action for the current Selected Wallet master. Constructs its own exchange
 * gateway internally — mirrors BuilderFeeProvider. Exposes the venue-agnostic
 * `Hip3AbstractionState`; `app/` bridges it into the shared
 * `VenueHip3AbstractionProvider` so the shared gate button can read it. See
 * ADR-0081.
 */
export function Hip3AbstractionProvider({ children }: { children: ReactNode }) {
  const exchangeGateway = useMemo(
    () =>
      createNktkasHyperliquidExchangeGateway({
        isTestnet,
        logger,
      }),
    [],
  )

  const state = useOwnHip3Abstraction(exchangeGateway)

  return (
    <Hip3AbstractionContext.Provider value={state}>
      {children}
    </Hip3AbstractionContext.Provider>
  )
}
