import { useVenueOptional } from '../../providers/venue-provider'
import { useManageFunds, MANAGE_FUNDS_TABS } from '../../providers/manage-funds-provider'
import type { ManageFundsTab } from '../../providers/manage-funds-provider'
import { useIsMobile } from '../../hooks/use-is-mobile'
import { MANAGE_FUNDS_TAB_ICONS } from './manage-funds-modal.constants'
import type {
  CapabilityView,
  ManageFundsModalContent,
  ManageFundsNavTab,
  TransferCapabilityView,
} from './manage-funds-modal.types'

/**
 * Smart hook for `<ManageFundsModal>`. Reads the open/active-tab controller
 * (`useManageFunds`) and the active venue (`useVenueOptional`), then resolves
 * each money-movement capability into an opaque `{ Provider, Body }` view. Every
 * tab is `isAvailable` iff the matching venue capability exists; a tab whose
 * capability is absent renders an unsupported note. Venue-agnostic — it only
 * learns *whether* each flow exists, never anything about it.
 */
export function useManageFundsModal(): ManageFundsModalContent {
  const { isOpen, activeTab, close, setActiveTab } = useManageFunds()
  const venue = useVenueOptional()
  const isMobile = useIsMobile()

  const depositCap = venue?.deposit ?? null
  const transferCap = venue?.transfer ?? null
  const withdrawCap = venue?.withdraw ?? null
  const sendCap = venue?.send ?? null
  const evmCoreCap = venue?.evmCore ?? null

  const deposit: CapabilityView | null = depositCap
    ? { Provider: depositCap.provider, Body: depositCap.body }
    : null
  const transfer: TransferCapabilityView | null = transferCap
    ? {
        Provider: transferCap.provider,
        Body: transferCap.body,
        useTransfer: transferCap.useTransfer,
      }
    : null
  const withdraw: CapabilityView | null = withdrawCap
    ? { Provider: withdrawCap.provider, Body: withdrawCap.body }
    : null
  const send: CapabilityView | null = sendCap
    ? { Provider: sendCap.provider, Body: sendCap.body }
    : null
  const evmCore: CapabilityView | null = evmCoreCap
    ? { Provider: evmCoreCap.provider, Body: evmCoreCap.body }
    : null

  const availabilityByTab: Record<ManageFundsTab, boolean> = {
    deposit: deposit !== null,
    transfer: transfer !== null,
    withdraw: withdraw !== null,
    send: send !== null,
    'evm-core': evmCore !== null,
  }

  const tabs: ReadonlyArray<ManageFundsNavTab> = MANAGE_FUNDS_TABS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    Icon: MANAGE_FUNDS_TAB_ICONS[tab.id],
    isAvailable: availabilityByTab[tab.id],
  }))

  return {
    isOpen,
    activeTab,
    close,
    onSelectTab: setActiveTab,
    tabs,
    isMobile,
    deposit,
    transfer,
    withdraw,
    send,
    evmCore,
  }
}
