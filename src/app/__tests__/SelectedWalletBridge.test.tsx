import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WalletAddress } from '@/modules/shared/domain'
import type { Venue } from '@/modules/shared/domain'

const SELECTED = '0x5555000000000000000000000000000000000001' as WalletAddress
const PRIMARY = '0xaaaa000000000000000000000000000000000001' as WalletAddress

const setConnectedWalletAddress = vi.fn()
const useSelectedWallet = vi.fn()
const useAuth = vi.fn()
const useVenueOptional = vi.fn()

vi.mock('../wallet-address-holder', () => ({
  setConnectedWalletAddress: (value: WalletAddress | null) =>
    setConnectedWalletAddress(value),
}))

vi.mock('@/modules/account', () => ({
  useSelectedWallet: () => useSelectedWallet(),
  useAuth: () => useAuth(),
}))

vi.mock('@/modules/shared/providers/venue-provider', () => ({
  useVenueOptional: () => useVenueOptional(),
}))

import { SelectedWalletBridge } from '../selected-wallet-bridge'

function makeFakeVenue() {
  const refreshAddress = vi.fn()
  const refreshActingAddress = vi.fn()
  const venue = {
    metadata: { id: 'mock', label: 'mock' },
    capabilities: { connection: { status: () => 'connected', subscribe: () => () => {} } },
    refreshAddress,
    refreshActingAddress,
  } as unknown as Venue
  return { venue, refreshAddress, refreshActingAddress }
}

describe('SelectedWalletBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ primaryWalletAddress: PRIMARY })
  })

  it('mirrors the selected address and refreshes both venue surfaces', () => {
    const { venue, refreshAddress, refreshActingAddress } = makeFakeVenue()
    useSelectedWallet.mockReturnValue({ selectedAddress: SELECTED })
    useVenueOptional.mockReturnValue(venue)

    render(<SelectedWalletBridge />)

    expect(setConnectedWalletAddress).toHaveBeenLastCalledWith(SELECTED)
    expect(refreshAddress).toHaveBeenCalledTimes(1)
    expect(refreshActingAddress).toHaveBeenCalledTimes(1)
  })

  it('re-mirrors when the selected address changes', () => {
    const { venue } = makeFakeVenue()
    useSelectedWallet.mockReturnValue({ selectedAddress: SELECTED })
    useVenueOptional.mockReturnValue(venue)

    const view = render(<SelectedWalletBridge />)
    expect(setConnectedWalletAddress).toHaveBeenLastCalledWith(SELECTED)

    const OTHER = '0x6666000000000000000000000000000000000002' as WalletAddress
    useSelectedWallet.mockReturnValue({ selectedAddress: OTHER })
    view.rerender(<SelectedWalletBridge />)

    expect(setConnectedWalletAddress).toHaveBeenLastCalledWith(OTHER)
  })

  it('falls back to the primary wallet when there is no stored selection', () => {
    const { venue } = makeFakeVenue()
    useSelectedWallet.mockReturnValue({ selectedAddress: null })
    useVenueOptional.mockReturnValue(venue)

    render(<SelectedWalletBridge />)

    expect(setConnectedWalletAddress).toHaveBeenLastCalledWith(PRIMARY)
  })
})
