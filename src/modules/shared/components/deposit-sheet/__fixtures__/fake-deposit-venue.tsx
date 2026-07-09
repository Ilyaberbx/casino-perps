import { type ReactNode } from 'react'
import type { Venue, VenueDepositCapability } from '@/modules/shared/domain'
import { VenueProvider } from '../../../providers/venue-provider'
import { DepositSheetProvider } from '../../../providers/deposit-sheet-provider'

export const DEPOSIT_BODY_TEXT = 'fake venue deposit body'

/**
 * A deposit capability whose `body` renders an identifiable marker, so shell
 * tests can assert the venue body is mounted inside the host chrome without
 * knowing anything about a real venue's flow (Option A: the host is opaque).
 */
export function buildFakeDepositCapability(): VenueDepositCapability {
  return {
    provider: ({ children }: { children: ReactNode }) => <>{children}</>,
    body: () => <div data-testid="deposit-body">{DEPOSIT_BODY_TEXT}</div>,
    useDeposit: () => ({ isComplete: false }),
  }
}

export function buildVenueWithDeposit(): Venue {
  return {
    metadata: { id: 'fake-deposit', label: 'Fake Deposit Venue' },
    capabilities: { connection: { status: () => 'connected', subscribe: () => () => {} } },
    deposit: buildFakeDepositCapability(),
  }
}

export function buildVenueWithoutDeposit(): Venue {
  return {
    metadata: { id: 'fake-no-deposit', label: 'Fake No-Deposit Venue' },
    capabilities: { connection: { status: () => 'connected', subscribe: () => () => {} } },
  }
}

interface WrapOptions {
  readonly venue: Venue
  readonly defaultSheetOpen?: boolean
}

export function wrapWithDepositVenue({ venue, defaultSheetOpen = false }: WrapOptions) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <VenueProvider venue={venue}>
        <DepositSheetProvider defaultOpen={defaultSheetOpen}>{children}</DepositSheetProvider>
      </VenueProvider>
    )
  }
}
