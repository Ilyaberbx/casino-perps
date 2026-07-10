import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MarketCardSkeleton } from '../MarketCardSkeleton'

describe('MarketCardSkeleton', () => {
  it('renders a presentational, aria-hidden placeholder', () => {
    const { container } = render(<MarketCardSkeleton />)
    const root = container.firstChild as HTMLElement
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root.getAttribute('role')).toBe('presentation')
  })

  it('exposes no accessible content', () => {
    const { container } = render(<MarketCardSkeleton />)
    expect(container.querySelectorAll('img').length).toBe(0)
    expect(container.textContent).toBe('')
  })
})
