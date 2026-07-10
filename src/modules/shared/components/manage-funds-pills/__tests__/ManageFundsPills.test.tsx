import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ManageFundsPills } from '../ManageFundsPills'
import { buildPillsVenue, wrapWithPillsVenue } from '../__fixtures__/fake-pills-venue'

describe('ManageFundsPills', () => {
  beforeEach(() => localStorage.clear())

  it('renders nothing when the venue exposes no money-movement capability', () => {
    // No AuthProvider is mounted: a venue with no capability must short-circuit to
    // `null` *before* reaching the wallet gate, so the missing auth context is
    // never read. This proves the capability gate runs first (mirrors
    // DepositTrigger).
    const { container } = render(<ManageFundsPills />, {
      wrapper: wrapWithPillsVenue(buildPillsVenue()),
    })
    expect(container).toBeEmptyDOMElement()
  })

  // Pro mode is gone (PRD-0008 D7): the row always collapses to a single
  // Manage Funds button.
  it('collapses to a single Manage Funds button', () => {
    render(<ManageFundsPills />, {
      wrapper: wrapWithPillsVenue(
        buildPillsVenue({ deposit: true, transfer: true, withdraw: true }),
        { connected: true },
      ),
    })
    expect(screen.getByRole('button', { name: 'Manage Funds' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deposit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Perps⇄Spot' })).not.toBeInTheDocument()
  })
})
