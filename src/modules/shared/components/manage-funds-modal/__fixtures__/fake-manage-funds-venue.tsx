import type { ReactNode } from 'react'
import type {
  Venue,
  VenueDepositCapability,
  VenueEvmCoreCapability,
  VenueSendCapability,
  VenueTransferCapability,
  VenueWithdrawCapability,
} from '@/modules/shared/domain'
import { VenueProvider } from '../../../providers/venue-provider'
import { ManageFundsProvider } from '../../../providers/manage-funds-provider'
import type { ManageFundsTab } from '../../../providers/manage-funds-provider'

export const DEPOSIT_BODY_TEXT = 'fake deposit body'
export const TRANSFER_BODY_TEXT = 'fake transfer body'
export const WITHDRAW_BODY_TEXT = 'fake withdraw body'
export const SEND_BODY_TEXT = 'fake send body'
export const EVM_CORE_BODY_TEXT = 'fake evm-core body'

const passthroughProvider = ({ children }: { children: ReactNode }) => <>{children}</>

export function buildFakeDepositCapability(): VenueDepositCapability {
  return {
    provider: passthroughProvider,
    body: () => <div data-testid="deposit-body">{DEPOSIT_BODY_TEXT}</div>,
    useDeposit: () => ({ isComplete: false }),
  }
}

export function buildFakeTransferCapability(isApplicable = true): VenueTransferCapability {
  return {
    provider: passthroughProvider,
    body: () => <div data-testid="transfer-body">{TRANSFER_BODY_TEXT}</div>,
    useTransfer: () => ({ isApplicable, isComplete: false }),
  }
}

export function buildFakeWithdrawCapability(isApplicable = true): VenueWithdrawCapability {
  return {
    provider: passthroughProvider,
    body: () => <div data-testid="withdraw-body">{WITHDRAW_BODY_TEXT}</div>,
    useWithdraw: () => ({ isApplicable, isComplete: false }),
  }
}

export function buildFakeSendCapability(isApplicable = true): VenueSendCapability {
  return {
    provider: passthroughProvider,
    body: () => <div data-testid="send-body">{SEND_BODY_TEXT}</div>,
    useSend: () => ({ isApplicable, isComplete: false }),
  }
}

export function buildFakeEvmCoreCapability(isApplicable = true): VenueEvmCoreCapability {
  return {
    provider: passthroughProvider,
    body: () => <div data-testid="evm-core-body">{EVM_CORE_BODY_TEXT}</div>,
    useEvmCore: () => ({ isApplicable, isComplete: false }),
  }
}

interface BuildVenueOptions {
  readonly deposit?: boolean
  readonly transfer?: boolean
  readonly transferApplicable?: boolean
  readonly withdraw?: boolean
  readonly send?: boolean
  readonly evmCore?: boolean
}

export function buildManageFundsVenue(options: BuildVenueOptions = {}): Venue {
  return {
    metadata: { id: 'fake-manage-funds', label: 'Fake Manage Funds Venue' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
    },
    deposit: options.deposit ? buildFakeDepositCapability() : undefined,
    transfer: options.transfer
      ? buildFakeTransferCapability(options.transferApplicable ?? true)
      : undefined,
    withdraw: options.withdraw ? buildFakeWithdrawCapability() : undefined,
    send: options.send ? buildFakeSendCapability() : undefined,
    evmCore: options.evmCore ? buildFakeEvmCoreCapability() : undefined,
  }
}

interface WrapOptions {
  readonly venue: Venue
  readonly defaultOpen?: boolean
  readonly defaultTab?: ManageFundsTab
}

export function wrapWithManageFundsVenue({
  venue,
  defaultOpen = false,
  defaultTab,
}: WrapOptions) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <VenueProvider venue={venue}>
        <ManageFundsProvider defaultOpen={defaultOpen} defaultTab={defaultTab}>
          {children}
        </ManageFundsProvider>
      </VenueProvider>
    )
  }
}
