import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { okAsync } from 'neverthrow'
import type { Hip3AbstractionState, Hip3AbstractionStatus } from '@/modules/shared/domain'
import { VenueHip3AbstractionProvider } from '../../../providers/venue-hip3-abstraction-provider'
import { Hip3AbstractionGateButton } from '../Hip3AbstractionGateButton'

function makeState(
  status: Hip3AbstractionStatus,
  enable = () => okAsync<void, never>(undefined),
): Hip3AbstractionState {
  return { status, enable }
}

function renderGate(value: Hip3AbstractionState | null, isHip3: boolean) {
  return render(
    <VenueHip3AbstractionProvider value={value}>
      <Hip3AbstractionGateButton isHip3={isHip3}>
        <button type="submit">Place Order</button>
      </Hip3AbstractionGateButton>
    </VenueHip3AbstractionProvider>,
  )
}

describe('Hip3AbstractionGateButton', () => {
  it('renders children when the market is not HIP-3 (even if abstraction is disabled)', () => {
    renderGate(makeState('disabled'), false)
    expect(screen.getByRole('button', { name: 'Place Order' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /enable hip-3/i })).not.toBeInTheDocument()
  })

  it('renders children when the venue exposes no HIP-3 capability', () => {
    renderGate(null, true)
    expect(screen.getByRole('button', { name: 'Place Order' })).toBeInTheDocument()
  })

  it('renders children when abstraction is already enabled', () => {
    renderGate(makeState('enabled'), true)
    expect(screen.getByRole('button', { name: 'Place Order' })).toBeInTheDocument()
  })

  it('renders a disabled "Checking…" button while the mode read is in flight', () => {
    renderGate(makeState('checking'), true)
    const checking = screen.getByRole('button', { name: /checking/i })
    expect(checking).toBeDisabled()
    expect(checking).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('button', { name: 'Place Order' })).not.toBeInTheDocument()
  })

  it('renders a disabled "Enabling HIP-3…" button while the signature is in flight', () => {
    renderGate(makeState('enabling'), true)
    const enabling = screen.getByRole('button', { name: /enabling hip-3/i })
    expect(enabling).toBeDisabled()
  })

  it('renders an "Enable HIP-3 trading" button for a disabled default account and calls enable on click', async () => {
    const enable = vi.fn(() => okAsync<void, never>(undefined))
    renderGate(makeState('disabled', enable), true)
    const btn = screen.getByRole('button', { name: /enable hip-3 trading/i })
    expect(screen.queryByRole('button', { name: 'Place Order' })).not.toBeInTheDocument()
    await userEvent.click(btn)
    expect(enable).toHaveBeenCalledTimes(1)
  })

  it('shows an error hint alongside the enable button after a failed attempt', () => {
    renderGate(makeState({ kind: 'error', reason: 'wallet-rejected' }), true)
    expect(screen.getByRole('button', { name: /enable hip-3 trading/i })).toBeInTheDocument()
    expect(screen.getByText(/signature cancelled/i)).toBeInTheDocument()
  })
})
