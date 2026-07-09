import { useEffect, useMemo, useState, useCallback } from 'react'
import { RouterProvider } from 'react-router-dom'
import { VenueProvider } from '@/modules/shared/providers/venue-provider'
import { ThemeProvider } from '@/modules/shared/providers/theme-provider'
import { SettingsProvider } from '@/modules/shared/providers/settings-provider'
import { TradingModeProvider } from '@/modules/shared/providers/trading-mode-provider'
import { ToastProvider } from '@/modules/shared/providers/toast-provider'
import { ConnectionRecoveryProvider } from '@/modules/shared/providers/connection-recovery'
import { useVenueSession } from '@/modules/shared/hooks/use-venue-session'
import { logger } from './logger'
import { connectionLiveness } from './connection-liveness'
import { AuthProvider } from '@/modules/account'
import { router } from './router'
import { PRIVY_APP_ID } from './privy.config'
import { API_BASE_URL } from './api.config'
import { findVenue, VENUES, DEFAULT_VENUE_ID } from './venues'
import { readVenueIdFromStorage, writeVenueIdToStorage } from './venue-storage'
import { VenueSelectionContext } from './venue-selection.context'
import { getCurrentWalletAddress, getActingWalletAddress } from './wallet-address-holder'
import type { Venue } from '@/modules/shared/domain'
import type { VenueId, VenueSelectionContextValue } from './venues.types'

function App() {
  return (
    <ToastProvider>
      <AuthProvider appId={PRIVY_APP_ID} apiBaseUrl={API_BASE_URL}>
        <ThemeProvider>
          <SettingsProvider>
            <TradingModeProvider>
              <AppShell />
            </TradingModeProvider>
          </SettingsProvider>
        </ThemeProvider>
      </AuthProvider>
    </ToastProvider>
  )
}

function AppShell() {
  const [venueId, setVenueId] = useState<VenueId>(() => {
    const result = readVenueIdFromStorage()
    if (!result.isOk()) return DEFAULT_VENUE_ID
    const exists = VENUES.some((entry) => entry.id === result.value)
    return exists ? result.value : DEFAULT_VENUE_ID
  })

  useEffect(() => {
    writeVenueIdToStorage(venueId)
  }, [venueId])

  // Start the connection-liveness coordinator once for the app's lifetime: its
  // visibilitychange/online listeners + watchdog drive the stream resync that
  // recovers a silently-dead socket after a tab resume (ADR-0041).
  useEffect(() => connectionLiveness.start(), [])

  const createVenue = useCallback(
    (id: VenueId): Venue =>
      findVenue(id).create({
        getAddress: getCurrentWalletAddress,
        getActingAddress: getActingWalletAddress,
      }),
    [],
  )

  const { venue, recovery } = useVenueSession({
    venueId,
    createVenue,
    logger,
  })

  const selectVenue = useCallback((id: VenueId) => {
    setVenueId(id)
  }, [])

  const availableVenues = useMemo(
    () => VENUES.map((entry) => ({ id: entry.id, label: entry.label })),
    [],
  )

  const venueSelection = useMemo<VenueSelectionContextValue>(
    () => ({ venueId, selectVenue, availableVenues }),
    [venueId, selectVenue, availableVenues],
  )

  return (
    <VenueSelectionContext.Provider value={venueSelection}>
      <ConnectionRecoveryProvider value={recovery}>
        <VenueProvider key={venue.metadata.id} venue={venue}>
          <RouterProvider router={router} />
        </VenueProvider>
      </ConnectionRecoveryProvider>
    </VenueSelectionContext.Provider>
  )
}

export default App
