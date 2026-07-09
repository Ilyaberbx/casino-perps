import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DisclaimerFooter } from '../DisclaimerFooter'
import {
  ORDER_DISCLAIMER_LINK_LABEL,
  ORDER_DISCLAIMER_PREFIX,
  ORDER_DISCLAIMER_SUFFIX,
} from '../order-entry.constants'

describe('DisclaimerFooter', () => {
  it('renders the muted legal disclaimer line', () => {
    render(<DisclaimerFooter />)
    expect(
      screen.getByText((_, node) => node?.textContent === `${ORDER_DISCLAIMER_PREFIX}${ORDER_DISCLAIMER_LINK_LABEL}${ORDER_DISCLAIMER_SUFFIX}`, {
        selector: 'p',
      }),
    ).toBeInTheDocument()
  })

  it('links "Terms of Use" to the canonical /terms page', () => {
    render(<DisclaimerFooter />)
    const link = screen.getByRole('link', { name: ORDER_DISCLAIMER_LINK_LABEL })
    expect(link.getAttribute('href')).toMatch(/\/terms$/)
  })
})
