import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { okAsync } from 'neverthrow'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { VenueContext } from '../../../../shared/providers/venue-provider/venue-provider.context'
import { SelectedMarketContext } from '../../../providers/selected-market-provider/selected-market-provider.context'
import { LeverageMarginProvider } from '../../../providers/leverage-margin'
import type { LeverageController, MarginModeController, Venue } from '../../../../shared/domain'
import { LeverageMargin } from '../LeverageMargin'

interface VenueOptions {
  leverageController?: LeverageController
  marginModeController?: MarginModeController
}

function buildVenue(options: VenueOptions): Venue {
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      ...options,
    },
  }
}

function buildWrapper(venue: Venue) {
  return ({ children }: { children: ReactNode }) =>
    createElement(
      VenueContext.Provider,
      { value: venue },
      createElement(
        SelectedMarketContext.Provider,
        {
          value: {
            selectedMarket: 'BTC-PERP',
            setSelectedMarket: () => {},
            market: {
              symbol: 'BTC-PERP',
              baseAsset: 'BTC',
              quoteAsset: 'USD',
              venue: 'mock',
              tickSize: 0.5,
              stepSize: 0.001,
              marketType: 'perp' as const,
              hlCoin: 'BTC',
              maxLeverage: 20,
            },
          },
        },
        createElement(LeverageMarginProvider, null, children),
      ),
    )
}

describe('LeverageMargin (inline section)', () => {
  it('hides the section entirely on a read-only venue (no controllers)', () => {
    const venue = buildVenue({})
    render(<LeverageMargin />, { wrapper: buildWrapper(venue) })
    expect(screen.queryByRole('slider', { name: /leverage slider/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: /leverage multiplier/i })).not.toBeInTheDocument()
  })

  it('renders the inline leverage slider + value chip + margin dropdown (no dialog)', () => {
    const venue = buildVenue({
      leverageController: { setLeverage: () => okAsync(undefined) },
      marginModeController: { setMarginMode: () => okAsync(undefined) },
    })
    render(<LeverageMargin />, { wrapper: buildWrapper(venue) })
    // Inline — no dialog, no chip-to-open trigger.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /leverage slider/i })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /leverage multiplier/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /margin mode/i })).toBeInTheDocument()
  })

  it('shows the leverage slider even when only the leverage controller is present', () => {
    const venue = buildVenue({
      leverageController: { setLeverage: () => okAsync(undefined) },
    })
    render(<LeverageMargin />, { wrapper: buildWrapper(venue) })
    expect(screen.getByRole('slider', { name: /leverage slider/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /margin mode/i })).not.toBeInTheDocument()
  })

  it('commits a leverage change through the controller exactly once on numeric blur', async () => {
    const user = userEvent.setup()
    const setLeverage = vi.fn(() => okAsync(undefined))
    const venue = buildVenue({ leverageController: { setLeverage } })
    render(<LeverageMargin />, { wrapper: buildWrapper(venue) })

    const input = screen.getByRole('spinbutton', { name: /leverage multiplier/i })
    await user.clear(input)
    await user.type(input, '12')
    await user.tab()

    expect(setLeverage).toHaveBeenCalledTimes(1)
    expect(setLeverage).toHaveBeenCalledWith('BTC-PERP', 12)
  })

  it('commits a leverage change through the controller on slider release', async () => {
    const setLeverage = vi.fn(() => okAsync(undefined))
    const venue = buildVenue({ leverageController: { setLeverage } })
    render(<LeverageMargin />, { wrapper: buildWrapper(venue) })

    const slider = screen.getByRole('slider', { name: /leverage slider/i })
    // Drive the native range input then release (commit-on-release semantics).
    slider.focus()
    fireSliderChange(slider, 7)
    slider.dispatchEvent(new Event('pointerup', { bubbles: true }))

    expect(setLeverage).toHaveBeenCalledTimes(1)
    expect(setLeverage).toHaveBeenCalledWith('BTC-PERP', 7)
  })
})

function fireSliderChange(slider: HTMLElement, value: number): void {
  const input = slider as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, String(value))
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
