import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AiMascot } from '../AiMascot'

describe('AiMascot', () => {
  it('renders the static sprite as crisp rects with a label as role=img', () => {
    render(<AiMascot label="AI agent" />)
    const svg = screen.getByRole('img', { name: 'AI agent' })
    expect(svg).toHaveAttribute('shape-rendering', 'crispEdges')
    expect(svg.querySelectorAll('rect').length).toBeGreaterThan(0)
  })

  it('is decorative (aria-hidden, no role) when no label is given', () => {
    const { container } = render(<AiMascot />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('applies the requested size to the static svg', () => {
    render(<AiMascot label="AI agent" size={40} />)
    const svg = screen.getByRole('img', { name: 'AI agent' })
    expect(svg).toHaveAttribute('width', '40')
    expect(svg).toHaveAttribute('height', '40')
  })

  it('layers the GIF over a static fallback when animated', () => {
    const { container } = render(<AiMascot animated label="AI agent" />)
    // Both contrast GIFs plus the reduced-motion static fallback are present;
    // CSS picks the visible layer per theme / motion preference.
    const gifs = container.querySelectorAll('img[aria-hidden="true"]')
    expect(gifs.length).toBe(2)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
