import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { VenueIcon } from '../VenueIcon'
import { resolveVenueIconSources } from '../venue-icon.utils'

describe('<VenueIcon />', () => {
  it('renders the bundled image for a known venue', () => {
    const { container } = render(<VenueIcon venueId="hyperliquid" label="Hyperliquid" size={18} />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('src', resolveVenueIconSources('hyperliquid') ?? '')
  })

  it('renders the first-char monogram fallback for an unknown venue', () => {
    const { container, getByText } = render(
      <VenueIcon venueId="mock" label="Mock" size={24} />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(getByText('M')).toBeInTheDocument()
  })

  it('renders the monogram once the resolved image errors', () => {
    const { container, getByText } = render(
      <VenueIcon venueId="hyperliquid" label="Hyperliquid" size={18} />,
    )
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    // Asserted non-null on the line above; the cast narrows for fireEvent.
    fireEvent.error(img as HTMLImageElement)
    expect(getByText('H')).toBeInTheDocument()
  })

  it('resolves a `:network`-suffixed id to the same source as the bare id', () => {
    const { container } = render(
      <VenueIcon venueId="hyperliquid:mainnet" label="Hyperliquid" size={18} />,
    )
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', resolveVenueIconSources('hyperliquid') ?? '')
  })
})
