import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DexSelector } from '../DexSelector'
import { DEX_OPTIONS } from '../dex-options.constants'
import { SOON_BADGE } from '../perp-suggestion-sheet.constants'
import type { SuggestionVenueId } from '../../../api/suggestions.types'

function renderSelector(
  selectedVenueId: SuggestionVenueId = 'hyperliquid',
  onSelect = vi.fn(),
) {
  render(
    <DexSelector
      options={DEX_OPTIONS}
      selectedVenueId={selectedVenueId}
      onSelect={onSelect}
    />,
  )
  return onSelect
}

const openMenu = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Select DEX' }))

describe('DexSelector', () => {
  it('opens a dropdown listing every DEX with its label', async () => {
    const user = userEvent.setup()
    renderSelector()
    await openMenu(user)
    expect(screen.getByRole('option', { name: /Hyperliquid/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Extended/ })).toBeInTheDocument()
  })

  it('shows the "soon" suffix on the coming-soon (Extended) DEX only', async () => {
    const user = userEvent.setup()
    renderSelector()
    await openMenu(user)
    expect(screen.getByRole('option', { name: /Extended/ })).toHaveTextContent(SOON_BADGE)
    expect(screen.getByRole('option', { name: /Hyperliquid/ })).not.toHaveTextContent(
      SOON_BADGE,
    )
  })

  it('marks the Extended DEX option disabled and Hyperliquid enabled', async () => {
    const user = userEvent.setup()
    renderSelector()
    await openMenu(user)
    expect(screen.getByRole('option', { name: /Extended/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByRole('option', { name: /Hyperliquid/ })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('invokes onSelect when an enabled DEX is chosen', async () => {
    const user = userEvent.setup()
    const onSelect = renderSelector('extended')
    await openMenu(user)
    await user.click(screen.getByRole('option', { name: /Hyperliquid/ }))
    expect(onSelect).toHaveBeenCalledWith('hyperliquid')
  })

  it('does not invoke onSelect when the disabled Extended DEX is clicked', async () => {
    const user = userEvent.setup()
    const onSelect = renderSelector()
    await openMenu(user)
    await user.click(screen.getByRole('option', { name: /Extended/ }))
    expect(onSelect).not.toHaveBeenCalled()
  })
})
