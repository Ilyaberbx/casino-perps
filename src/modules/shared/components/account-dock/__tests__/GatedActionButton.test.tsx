import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { GatedActionButton } from '../GatedActionButton'
import { VenueProvider } from '@/modules/shared/providers/venue-provider'
import {
  VenueOnboardingSheetProvider,
  useVenueOnboardingSheet,
} from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import {
  makeOnboardingStep,
  makeSyntheticVenue,
  makeVenueOnboarding,
} from '@/modules/shared/hooks/__fixtures__/venue-onboarding'
import type { Venue, VenueOnboardingStepStatus } from '@/modules/shared/domain'

type MqlListener = (event: MediaQueryListEvent) => void

interface FakeMql {
  matches: boolean
  listeners: MqlListener[]
}

function setMatchMedia(matchesMobile: boolean): FakeMql {
  const state: FakeMql = { matches: matchesMobile, listeners: [] }
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: state.matches,
    media: '(max-width: 1023.98px)',
    onchange: null,
    addEventListener: (_: string, cb: MqlListener) => {
      state.listeners.push(cb)
    },
    removeEventListener: (_: string, cb: MqlListener) => {
      state.listeners = state.listeners.filter((l) => l !== cb)
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
  return state
}

function buildVenue(stepStatus: VenueOnboardingStepStatus | 'none'): Venue {
  if (stepStatus === 'none') return makeSyntheticVenue()
  const onboarding = makeVenueOnboarding({
    steps: [makeOnboardingStep({ id: 'agent', capability: 'sign-actions', status: stepStatus })],
  })
  return makeSyntheticVenue({ onboarding })
}

function Wrapper({ venue, children }: { venue: Venue; children: ReactNode }) {
  return (
    <VenueProvider venue={venue}>
      <VenueOnboardingSheetProvider>{children}</VenueOnboardingSheetProvider>
    </VenueProvider>
  )
}

describe('GatedActionButton', () => {
  beforeEach(() => {
    setMatchMedia(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('invokes onClick when sign-actions capability is complete (predicate true)', async () => {
    const onClick = vi.fn()
    const venue = buildVenue('complete')
    render(
      <Wrapper venue={venue}>
        <GatedActionButton icon={X} onClick={onClick} disabledTooltip="tip" ariaLabel="Cancel order" />
      </Wrapper>,
    )
    const btn = screen.getByRole('button', { name: 'Cancel order' })
    await userEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(btn.getAttribute('aria-disabled')).toBe('false')
  })

  it('predicate true on venues with no onboarding flow (graceful default)', async () => {
    const onClick = vi.fn()
    const venue = buildVenue('none')
    render(
      <Wrapper venue={venue}>
        <GatedActionButton icon={X} onClick={onClick} disabledTooltip="tip" ariaLabel="Cancel order" />
      </Wrapper>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('marks the button aria-disabled and shows the info-icon on desktop when predicate is false', () => {
    const onClick = vi.fn()
    const venue = buildVenue('pending')
    render(
      <Wrapper venue={venue}>
        <GatedActionButton
          icon={X}
          onClick={onClick}
          disabledTooltip="Complete Hyperliquid setup to cancel orders"
          ariaLabel="Cancel order"
        />
      </Wrapper>,
    )
    const btn = screen.getByRole('button', { name: 'Cancel order' })
    expect(btn.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByTestId('gated-action-info-icon')).toBeInTheDocument()
  })

  it('renders the desktop tooltip via title attribute when disabled', () => {
    const venue = buildVenue('pending')
    const tooltip = 'Complete Hyperliquid setup to cancel orders'
    const { container } = render(
      <Wrapper venue={venue}>
        <GatedActionButton icon={X} onClick={() => {}} disabledTooltip={tooltip} ariaLabel="Cancel order" />
      </Wrapper>,
    )
    const wrap = container.querySelector('span[title]')
    expect(wrap).not.toBeNull()
    expect(wrap?.getAttribute('title')).toBe(tooltip)
  })

  it('clicking the info-icon opens the venue-onboarding sheet (desktop)', async () => {
    const onClick = vi.fn()
    const venue = buildVenue('pending')
    const sheetState: { value: boolean | null } = { value: null }
    function Spy() {
      const { isOpen } = useVenueOnboardingSheet()
      useEffect(() => {
        sheetState.value = isOpen
      }, [isOpen])
      return null
    }
    render(
      <Wrapper venue={venue}>
        <GatedActionButton
          icon={X}
          onClick={onClick}
          disabledTooltip="Complete Hyperliquid setup to cancel orders"
          ariaLabel="Cancel order"
        />
        <Spy />
      </Wrapper>,
    )
    expect(sheetState.value).toBe(false)
    await userEvent.click(screen.getByTestId('gated-action-info-icon'))
    expect(sheetState.value).toBe(true)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('on mobile, the disabled button opens the sheet directly (no tooltip, no info-icon)', async () => {
    setMatchMedia(true)
    const onClick = vi.fn()
    const venue = buildVenue('pending')
    const sheetState: { value: boolean | null } = { value: null }
    function Spy() {
      const { isOpen } = useVenueOnboardingSheet()
      useEffect(() => {
        sheetState.value = isOpen
      }, [isOpen])
      return null
    }
    const { container } = render(
      <Wrapper venue={venue}>
        <GatedActionButton
          icon={X}
          onClick={onClick}
          disabledTooltip="Complete Hyperliquid setup to cancel orders"
          ariaLabel="Cancel order"
        />
        <Spy />
      </Wrapper>,
    )
    expect(screen.queryByTestId('gated-action-info-icon')).toBeNull()
    expect(container.querySelector('span[title]')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }))
    expect(onClick).not.toHaveBeenCalled()
    expect(sheetState.value).toBe(true)
  })

  it('clicking the disabled button on desktop does not call onClick and does not open the sheet (info-icon is the trigger)', async () => {
    const onClick = vi.fn()
    const venue = buildVenue('pending')
    const sheetState: { value: boolean | null } = { value: null }
    function Spy() {
      const { isOpen } = useVenueOnboardingSheet()
      useEffect(() => {
        sheetState.value = isOpen
      }, [isOpen])
      return null
    }
    render(
      <Wrapper venue={venue}>
        <GatedActionButton
          icon={X}
          onClick={onClick}
          disabledTooltip="Complete Hyperliquid setup to cancel orders"
          ariaLabel="Cancel order"
        />
        <Spy />
      </Wrapper>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }))
    expect(onClick).not.toHaveBeenCalled()
    expect(sheetState.value).toBe(false)
  })
})
