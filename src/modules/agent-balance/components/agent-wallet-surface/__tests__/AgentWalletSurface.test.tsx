import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Stub the modal so the surface is asserted in isolation (the modal has its own
// coverage via the flows it hosts).
vi.mock('../../agent-wallet-modal', () => ({
  AgentWalletModal: () => <div data-testid="agent-wallet-modal" />,
}))

import { AgentWalletSurface } from '../AgentWalletSurface'

describe('AgentWalletSurface', () => {
  it('renders the centred AgentWalletModal (both modes, sheet removed)', () => {
    render(<AgentWalletSurface />)
    expect(screen.getByTestId('agent-wallet-modal')).toBeInTheDocument()
  })
})
