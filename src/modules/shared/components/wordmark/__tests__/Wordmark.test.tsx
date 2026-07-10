import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Wordmark } from '../Wordmark'
import { SIZE_CLASS } from '../wordmark.constants'
import { BRAND_NAME } from '../../../brand.constants'

describe('Wordmark', () => {
  it('renders the brand name as text', () => {
    render(<Wordmark />)
    expect(screen.getByText(BRAND_NAME)).toBeInTheDocument()
  })

  it('renders text, never an image (D10 — not yeet’s logo SVG)', () => {
    const { container } = render(<Wordmark />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg')).toBeNull()
    expect(container.textContent).toBe(BRAND_NAME)
  })

  it('defaults to the md size', () => {
    render(<Wordmark />)
    expect(screen.getByText(BRAND_NAME)).toHaveClass(SIZE_CLASS.md)
  })

  it('applies the requested size class', () => {
    render(<Wordmark size="lg" />)
    expect(screen.getByText(BRAND_NAME)).toHaveClass(SIZE_CLASS.lg)
  })

  it('forwards a custom className', () => {
    render(<Wordmark className="extra" />)
    expect(screen.getByText(BRAND_NAME)).toHaveClass('extra')
  })
})
