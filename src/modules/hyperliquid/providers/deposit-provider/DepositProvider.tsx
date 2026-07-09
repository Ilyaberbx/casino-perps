import { useMemo, type ReactNode } from 'react'
import { logger } from '@/app/logger'
import { loadHyperliquidConfig } from '../../hyperliquid.config'
import { createNktkasHyperliquidExchangeGateway } from '../../gateway/nktkas-hyperliquid-exchange-gateway'
import { DepositContext } from './deposit-provider.context'
import { useOwnDeposit } from './use-deposit'

// Load Hyperliquid config once at module init — mirrors AgentWalletProvider and BuilderFeeProvider.
const configResult = loadHyperliquidConfig(import.meta.env as Record<string, string | undefined>)
const isTestnet = configResult.isOk() ? configResult.value.network === 'testnet' : false

/**
 * DepositProvider owns the First Deposit milestone state for the current
 * wallet (ADR-0027 — chain-derived "ever funded", not a live balance).
 * Bootstraps from `gateway.queryHasEverFunded(user)` on session start and
 * exposes a `recheck()` affordance (the manual "I've deposited — re-check",
 * per D-7, one-shot not websocket; no signature required — Pitfall 4).
 *
 * Constructs its own exchange gateway internally — mirrors BuilderFeeProvider.
 */
export function DepositProvider({ children }: { children: ReactNode }) {
  const exchangeGateway = useMemo(
    () =>
      createNktkasHyperliquidExchangeGateway({
        isTestnet,
        logger,
      }),
    [],
  )

  const state = useOwnDeposit(exchangeGateway)

  return <DepositContext.Provider value={state}>{children}</DepositContext.Provider>
}
