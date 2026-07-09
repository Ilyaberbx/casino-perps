import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentIcon } from '../AgentIcon'

describe('AgentIcon', () => {
  it('renders the Minara mark for the minara kind', () => {
    render(<AgentIcon kind="minara" />)
    expect(screen.getByAltText('Minara')).toBeInTheDocument()
  })

  it('tags the Minara mark with data-animated reflecting the flag', () => {
    const { rerender } = render(<AgentIcon kind="minara" animated />)
    expect(screen.getByAltText('Minara')).toHaveAttribute('data-animated', 'true')
    rerender(<AgentIcon kind="minara" animated={false} />)
    expect(screen.getByAltText('Minara')).toHaveAttribute('data-animated', 'false')
  })

  it('renders the static three-eye SVG at rest (animated=false)', () => {
    render(<AgentIcon kind="three-eye" animated={false} />)
    expect(screen.getByRole('img', { name: 'AI agent' })).toBeInTheDocument()
  })

  it('renders the animated three-eye GIF during the loading beat (animated=true)', () => {
    const { container } = render(<AgentIcon kind="three-eye" animated />)
    // The animated branch is a decorative <img> (aria-hidden), not the SVG.
    expect(screen.queryByRole('img', { name: 'AI agent' })).not.toBeInTheDocument()
    const gif = container.querySelector('img[aria-hidden="true"]')
    expect(gif).toBeInTheDocument()
  })

  it('applies the requested size to the three-eye SVG', () => {
    render(<AgentIcon kind="three-eye" size={48} />)
    const svg = screen.getByRole('img', { name: 'AI agent' })
    expect(svg).toHaveAttribute('width', '48')
    expect(svg).toHaveAttribute('height', '48')
  })
})
