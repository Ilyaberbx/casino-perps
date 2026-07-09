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

  it('Pro mode renders the five funds-action pills', () => {
    render(<ManageFundsPills />, {
      wrapper: wrapWithPillsVenue(
        buildPillsVenue({ deposit: true, transfer: true, withdraw: true }),
        { mode: 'pro', connected: true },
      ),
    })
    expect(screen.getByRole('button', { name: 'Perps⇄Spot' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'EVM⇄Core' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deposit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Manage Funds' })).not.toBeInTheDocument()
  })

  it('Simple mode collapses to a single Manage Funds button', () => {
    render(<ManageFundsPills />, {
      wrapper: wrapWithPillsVenue(
        buildPillsVenue({ deposit: true, transfer: true, withdraw: true }),
        { mode: 'simple', connected: true },
      ),
    })
    expect(screen.getByRole('button', { name: 'Manage Funds' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deposit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Perps⇄Spot' })).not.toBeInTheDocument()
  })
})
