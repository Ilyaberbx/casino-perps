import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VenueOnboardingGateButton } from '../VenueOnboardingGateButton'
import { useVenueOnboardingSheet } from '../../../providers/venue-onboarding-sheet-provider'
import {
  buildFakeVenueOnboarding,
  wrapWithOnboarding,
} from '../../VenueOnboardingSheet/__fixtures__/fake-venue-onboarding'

describe('VenueOnboardingGateButton', () => {
  it('renders children when onboarding status is ready', () => {
    const onboarding = buildFakeVenueOnboarding({ status: 'ready' })
    render(
      <VenueOnboardingGateButton>
        <button type="submit">Place Order</button>
      </VenueOnboardingGateButton>,
      { wrapper: wrapWithOnboarding({ onboarding }) },
    )
    expect(screen.getByRole('button', { name: 'Place Order' })).toBeInTheDocument()
  })

  it('renders children when the venue has no onboarding slot', () => {
    render(
      <VenueOnboardingGateButton>
        <button type="submit">Place Order</button>
      </VenueOnboardingGateButton>,
      { wrapper: wrapWithOnboarding({ onboarding: null }) },
    )
    expect(screen.getByRole('button', { name: 'Place Order' })).toBeInTheDocument()
  })

  it('renders a disabled Checking… button when status is bootstrapping', () => {
    const onboarding = buildFakeVenueOnboarding({ status: 'bootstrapping' })
    render(
      <VenueOnboardingGateButton>
        <button type="submit">Place Order</button>
      </VenueOnboardingGateButton>,
      { wrapper: wrapWithOnboarding({ onboarding }) },
    )
    const checking = screen.getByRole('button', { name: /checking/i })
    expect(checking).toBeDisabled()
    expect(checking).toHaveAttribute('aria-busy', 'true')
  })

  it('renders Complete {venueLabel} Setup button when incomplete and opens the sheet', async () => {
    const user = userEvent.setup()
    const onboarding = buildFakeVenueOnboarding({
      venueLabel: 'Hyperliquid',
      status: 'incomplete',
    })
    render(
      <>
        <VenueOnboardingGateButton>
          <button type="submit">Place Order</button>
        </VenueOnboardingGateButton>
        <SheetStatusReporter />
      </>,
      { wrapper: wrapWithOnboarding({ onboarding }) },
    )

    const cta = screen.getByRole('button', { name: 'Complete Hyperliquid Setup' })
    expect(cta).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Place Order' })).not.toBeInTheDocument()
    expect(screen.getByTestId('sheet-open')).toHaveTextContent('false')
    await user.click(cta)
    expect(screen.getByTestId('sheet-open')).toHaveTextContent('true')
  })
})

function SheetStatusReporter() {
  const { isOpen } = useVenueOnboardingSheet()
  return <span data-testid="sheet-open">{String(isOpen)}</span>
}
