import { type ReactNode } from 'react'
import type {
  AccountModeReader,
  Venue,
  VenueTransferCapability,
} from '@/modules/shared/domain'
import { VenueProvider } from '../../../providers/venue-provider'
import { TransferSheetProvider } from '../../../providers/transfer-sheet-provider'

export const TRANSFER_BODY_TEXT = 'fake venue transfer body'

interface FakeTransferOptions {
  readonly isApplicable?: boolean
}

/** A static `accountMode` capability reporting a fixed `isSegregated`. */
export function buildFakeAccountModeReader(isSegregated: boolean): AccountModeReader {
  return {
    current: () => ({ isSegregated }),
    subscribe: () => () => {},
  }
}

/**
 * A transfer capability whose `body` renders an identifiable marker, so shell
 * tests can assert the venue body is mounted inside the host chrome without
 * knowing anything about a real venue's flow (Option A: the host is opaque).
 * `isApplicable` is configurable so the unified-account (`!isApplicable`) gate
 * can be exercised.
 */
export function buildFakeTransferCapability(
  options: FakeTransferOptions = {},
): VenueTransferCapability {
  const isApplicable = options.isApplicable ?? true
  return {
    provider: ({ children }: { children: ReactNode }) => <>{children}</>,
    body: () => <div data-testid="transfer-body">{TRANSFER_BODY_TEXT}</div>,
    useTransfer: () => ({ isApplicable, isComplete: false }),
  }
}

interface BuildVenueOptions extends FakeTransferOptions {
  /** When set, mounts an `accountMode` capability reporting this segregation. */
  readonly isSegregated?: boolean
}

export function buildVenueWithTransfer(options: BuildVenueOptions = {}): Venue {
  const accountMode =
    options.isSegregated === undefined
      ? undefined
      : buildFakeAccountModeReader(options.isSegregated)
  return {
    metadata: { id: 'fake-transfer', label: 'Fake Transfer Venue' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      accountMode,
    },
    transfer: buildFakeTransferCapability(options),
  }
}

export function buildVenueWithoutTransfer(): Venue {
  return {
    metadata: { id: 'fake-no-transfer', label: 'Fake No-Transfer Venue' },
    capabilities: { connection: { status: () => 'connected', subscribe: () => () => {} } },
  }
}

interface WrapOptions {
  readonly venue: Venue
  readonly defaultSheetOpen?: boolean
}

export function wrapWithTransferVenue({ venue, defaultSheetOpen = false }: WrapOptions) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <VenueProvider venue={venue}>
        <TransferSheetProvider defaultOpen={defaultSheetOpen}>{children}</TransferSheetProvider>
      </VenueProvider>
    )
  }
}
