import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VenueOnboardingBanner } from '../VenueOnboardingBanner'
import { useVenueOnboardingSheet } from '../../../providers/venue-onboarding-sheet-provider'
import {
  buildFakeVenueOnboarding,
  wrapWithOnboarding,
} from '../../VenueOnboardingSheet/__fixtures__/fake-venue-onboarding'

function SheetReporter() {
  const { isOpen } = useVenueOnboardingSheet()
  return <span data-testid="sheet-open">{String(isOpen)}</span>
}

describe('VenueOnboardingBanner', () => {
  it('is hidden when the wallet is not connected', () => {
    const onboarding = buildFakeVenueOnboarding({ status: 'incomplete' })
    const { container } = render(<VenueOnboardingBanner isWalletConnected={false} />, {
      wrapper: wrapWithOnboarding({ onboarding }),
    })
    expect(container).toBeEmptyDOMElement()
  })

  it('is hidden when the venue has no onboarding', () => {
    const { container } = render(<VenueOnboardingBanner isWalletConnected />, {
      wrapper: wrapWithOnboarding({ onboarding: null }),
    })
    expect(container).toBeEmptyDOMElement()
  })

  it('is hidden when status is bootstrapping', () => {
    const onboarding = buildFakeVenueOnboarding({ status: 'bootstrapping' })
    const { container } = render(<VenueOnboardingBanner isWalletConnected />, {
      wrapper: wrapWithOnboarding({ onboarding }),
    })
    expect(container).toBeEmptyDOMElement()
  })

  it('is hidden when status is ready', () => {
    const onboarding = buildFakeVenueOnboarding({ status: 'ready' })
    const { container } = render(<VenueOnboardingBanner isWalletConnected />, {
      wrapper: wrapWithOnboarding({ onboarding }),
    })
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the incomplete state with N of M progress and opens sheet on click', async () => {
    const user = userEvent.setup()
    const onboarding = buildFakeVenueOnboarding({
      venueLabel: 'Hyperliquid',
      status: 'incomplete',
      steps: [
        {
          id: 'agent',
          label: 'Agent',
          description: '',
          status: 'complete',
        },
        {
          id: 'builder',
          label: 'Builder',
          description: '',
          status: 'pending',
        },
      ],
    })
    render(
      <>
        <VenueOnboardingBanner isWalletConnected />
        <SheetReporter />
      </>,
      { wrapper: wrapWithOnboarding({ onboarding }) },
    )
    expect(screen.getByText(/Hyperliquid setup: 1\/2/i)).toBeInTheDocument()
    expect(screen.getByText(/Continue/i)).toBeInTheDocument()
    // Two buttons now (main area + close X); the main one opens the sheet.
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByTestId('sheet-open')).toHaveTextContent('true')
  })

  it('dismisses the banner when the close button is clicked', async () => {
    const user = userEvent.setup()
    const onboarding = buildFakeVenueOnboarding({
      venueLabel: 'Hyperliquid',
      status: 'incomplete',
      steps: [
        { id: 'agent', label: 'Agent', description: '', status: 'complete' },
        { id: 'builder', label: 'Builder', description: '', status: 'pending' },
      ],
    })
    const { container } = render(<VenueOnboardingBanner isWalletConnected />, {
      wrapper: wrapWithOnboarding({ onboarding }),
    })
    expect(screen.getByText(/Hyperliquid setup: 1\/2/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the in-flight state when a step is running and the sheet is closed', () => {
    const onboarding = buildFakeVenueOnboarding({
      venueLabel: 'Hyperliquid',
      status: 'incomplete',
      steps: [
        { id: 'agent', label: 'Agent', description: '', status: 'running' },
      ],
    })
    render(<VenueOnboardingBanner isWalletConnected />, {
      wrapper: wrapWithOnboarding({ onboarding }),
    })
    expect(screen.getByText(/Hyperliquid setting up/i)).toBeInTheDocument()
  })

  it('switches to incomplete state when the sheet is open while a step is running', () => {
    const onboarding = buildFakeVenueOnboarding({
      venueLabel: 'Hyperliquid',
      status: 'incomplete',
      steps: [
        { id: 'agent', label: 'Agent', description: '', status: 'running' },
      ],
    })
    render(<VenueOnboardingBanner isWalletConnected />, {
      wrapper: wrapWithOnboarding({ onboarding, defaultSheetOpen: true }),
    })
    // The sheet is open → the in-flight banner is suppressed; we show the
    // incomplete progress instead so the bar isn't a duplicate signal.
    expect(screen.queryByText(/setting up/i)).not.toBeInTheDocument()
    expect(screen.getByText(/0\/1/i)).toBeInTheDocument()
  })
})
