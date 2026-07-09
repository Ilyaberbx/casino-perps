import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '../Badge'
import { TONE_CLASS } from '../badge.constants'

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>PERPS</Badge>)
    expect(screen.getByText('PERPS')).toBeInTheDocument()
  })

  it('defaults to the neutral tone', () => {
    render(<Badge>XYZ</Badge>)
    expect(screen.getByText('XYZ')).toHaveClass(TONE_CLASS.neutral)
  })

  it('applies the requested tone class', () => {
    render(<Badge tone="directionUp">OPEN LONG</Badge>)
    expect(screen.getByText('OPEN LONG')).toHaveClass(TONE_CLASS.directionUp)
  })

  it('forwards aria-label and a custom className', () => {
    render(
      <Badge tone="accent" aria-label="Spot balance" className="extra">
        SPOT
      </Badge>,
    )
    const badge = screen.getByLabelText('Spot balance')
    expect(badge).toHaveTextContent('SPOT')
    expect(badge).toHaveClass('extra')
  })
})
