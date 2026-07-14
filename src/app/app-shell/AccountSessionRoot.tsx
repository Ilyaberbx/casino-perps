import { useMemo } from 'react'
import { Outlet } from 'react-router-dom'
import { OnboardingFlowProvider, OnboardingStepper, useAuth, useIsWalletConnected } from '@/modules/account'
import { FavoritesProvider, RecentMarketsProvider } from '@/modules/trading'
import { AgentWalletProvider, BuilderFeeProvider, DepositProvider } from '@/modules/hyperliquid'
import { SpectateProvider } from '@/modules/spectate'
import { useVenue } from '@/modules/shared/providers/venue-provider'
import { VenueOnboardingSheetProvider } from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import { DepositSheetProvider } from '@/modules/shared/providers/deposit-sheet-provider'
import { TransferSheetProvider } from '@/modules/shared/providers/transfer-sheet-provider'
import { ManageFundsProvider } from '@/modules/shared/providers/manage-funds-provider'
import { VenueOnboardingSeenStoreProvider } from '@/modules/shared/providers/venue-onboarding-seen-store-provider'
import { AppConfigProvider } from '@/modules/shared/providers/app-config-provider'
import { createVenueOnboardingSeenStore } from '@/modules/shared/services/venue-onboarding-seen-store'
import { logger } from '../logger'
import { SpectateBridge } from '../spectate-bridge'
import { SelectedWalletBridge } from '../selected-wallet-bridge'
import { AgentSigningWalletBridge } from '../agent-signing-wallet-bridge'
import { VenueOnboardingSession } from './VenueOnboardingSession'
import { VenueHip3AbstractionSession } from './VenueHip3AbstractionSession'

export function AccountSessionRoot() {
  const { privyId, apiClient, authenticated } = useAuth()
  const isWalletConnected = useIsWalletConnected()
  const venue = useVenue()
  const seenStore = useMemo(() => createVenueOnboardingSeenStore({ logger }), [])
  return (
    <VenueOnboardingSheetProvider>
      <DepositSheetProvider>
      <TransferSheetProvider>
      <ManageFundsProvider>
      <VenueOnboardingSeenStoreProvider
        privyId={privyId}
        venueId={venue.metadata.id}
        store={seenStore}
      >
        <AppConfigProvider apiClient={apiClient} enabled={authenticated}>
        <OnboardingFlowProvider>
          {/*
            One shared onboarding-flow instance for the whole authenticated app.
            The header account trigger (AppShell, rendered via this Outlet) and
            the OnboardingStepper both consume THIS context — so completing the
            handle/2FA step in the stepper flips the header trigger to its
            ready state with no reload. Mounting the stepper anywhere outside
            this provider would give it a separate flow instance (the bug that
            left the account button hidden after onboarding).
          */}
          <OnboardingStepper />
          <SelectedWalletBridge />
          <DepositProvider>
            <AgentWalletProvider>
              <AgentSigningWalletBridge />
              <BuilderFeeProvider>
                <VenueOnboardingSession>
                  <VenueHip3AbstractionSession>
                    <SpectateProvider isWalletConnected={isWalletConnected}>
                      <SpectateBridge />
                      {/*
                        Favorites and Recent are app-wide, not trade-route state: the left
                        rail exposes both as lobby views (`/?view=favorites`, `/?view=recent`)
                        and the shell's SearchOverlay renders the market picker above the
                        `/trade/:symbol` route. Mounted here so every consumer shares one
                        store — the lobby reads them, `SelectedMarketProvider` (mounted far
                        below, under `/trade/*`) writes Recent.
                      */}
                      <FavoritesProvider>
                        <RecentMarketsProvider>
                          <Outlet />
                        </RecentMarketsProvider>
                      </FavoritesProvider>
                    </SpectateProvider>
                  </VenueHip3AbstractionSession>
                </VenueOnboardingSession>
              </BuilderFeeProvider>
            </AgentWalletProvider>
          </DepositProvider>
        </OnboardingFlowProvider>
        </AppConfigProvider>
      </VenueOnboardingSeenStoreProvider>
      </ManageFundsProvider>
      </TransferSheetProvider>
      </DepositSheetProvider>
    </VenueOnboardingSheetProvider>
  )
}
