import type { ReactNode } from 'react'
import { useAgentWallet } from '../agent-wallet-provider'
import { useBuilderFee } from '../builder-fee-provider'
import { useDeposit } from '../deposit-provider'
import { HyperliquidOnboardingContext } from './hyperliquid-onboarding-provider.context'
import { useOwnHyperliquidVenueOnboarding } from './use-own-hyperliquid-venue-onboarding'

/**
 * Composes the `DepositProvider` + `AgentWalletProvider` + `BuilderFeeProvider`
 * states into a single venue-agnostic `VenueOnboarding` value, exposed via
 * context.
 *
 * Must be mounted INSIDE `<DepositProvider>`, `<AgentWalletProvider>`, and
 * `<BuilderFeeProvider>` — those continue to own the underlying funded-state/
 * signing/keystore logic; this provider is a pure aggregator.
 *
 * Mount order in `AccountSessionRoot`:
 *   OnboardingFlowProvider > DepositProvider > AgentWalletProvider > BuilderFeeProvider
 *   > VenueOnboardingSession (which mounts HyperliquidOnboardingProvider)
 *
 * See `.design/hyperliquid-onboarding/TASKS.md` PR 3 T3.6, ADR-0026, and
 * Phase 07 Plan 04 (DEP-05) for the 3-step deposit→agent→builder wiring.
 */
export function HyperliquidOnboardingProvider({ children }: { children: ReactNode }) {
  const agent = useAgentWallet()
  const builder = useBuilderFee()
  const deposit = useDeposit()
  const value = useOwnHyperliquidVenueOnboarding({ agent, builder, deposit })

  return (
    <HyperliquidOnboardingContext.Provider value={value}>
      {children}
    </HyperliquidOnboardingContext.Provider>
  )
}
