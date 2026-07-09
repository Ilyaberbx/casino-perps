import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ManageFundsModalContent } from '../manage-funds-modal.types'

const useManageFundsModalMock = vi.fn<() => ManageFundsModalContent>()

vi.mock('../use-manage-funds-modal', () => ({
  useManageFundsModal: () => useManageFundsModalMock(),
}))
// The nav + pane read providers; stub them so this dumb-shell test stays isolated.
vi.mock('../ManageFundsNav', () => ({ ManageFundsNav: () => <nav /> }))
vi.mock('../ManageFundsPane', () => ({ ManageFundsPane: () => <div /> }))

import { ManageFundsModal } from '../ManageFundsModal'

function content(overrides: Partial<ManageFundsModalContent> = {}): ManageFundsModalContent {
  return {
    isOpen: true,
    activeTab: 'deposit',
    close: vi.fn(),
    onSelectTab: vi.fn(),
    tabs: [],
    isMobile: false,
    deposit: null,
    transfer: null,
    withdraw: null,
    send: null,
    evmCore: null,
    ...overrides,
  }
}

describe('ManageFundsModal', () => {
  beforeEach(() => useManageFundsModalMock.mockReset())

  it('renders the two-column shell without a wallet-switcher header bar', () => {
    useManageFundsModalMock.mockReturnValue(content())
    render(<ManageFundsModal />)
    // The header wallet switcher was removed — no "Wallet" bar label.
    expect(screen.queryByText('Wallet')).not.toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
