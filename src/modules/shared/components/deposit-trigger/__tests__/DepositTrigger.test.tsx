import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DepositTrigger } from '../DepositTrigger'
import {
  buildVenueWithoutDeposit,
  wrapWithDepositVenue,
} from '../../deposit-sheet/__fixtures__/fake-deposit-venue'

describe('DepositTrigger', () => {
  it('renders nothing when the active venue has no deposit capability', () => {
    // No AuthProvider is mounted: a venue without `deposit` must short-circuit to
    // `null` *before* reaching the wallet gate, so the missing auth context is
    // never read. This proves the capability gate runs first.
    const wrapper = wrapWithDepositVenue({ venue: buildVenueWithoutDeposit() })
    const { container } = render(<DepositTrigger />, { wrapper })

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
