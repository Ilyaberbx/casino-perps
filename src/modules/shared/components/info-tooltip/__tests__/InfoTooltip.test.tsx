import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InfoTooltip } from '../InfoTooltip'

describe('InfoTooltip', () => {
  it('shows the label and hides the panel until hovered', () => {
    render(<InfoTooltip label="Total Equity" content="Your total equity." />)
    expect(screen.getByRole('button', { name: 'Total Equity' })).toBeInTheDocument()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('reveals the panel on hover and on focus, hides on leave/blur', () => {
    render(<InfoTooltip label="Maintenance Margin" content="The minimum portfolio value." />)
    const trigger = screen.getByRole('button', { name: 'Maintenance Margin' })

    fireEvent.mouseEnter(trigger)
    expect(screen.getByRole('tooltip')).toHaveTextContent('The minimum portfolio value.')

    fireEvent.mouseLeave(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    fireEvent.focus(trigger)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.blur(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('toggles on click for touch/keyboard', () => {
    render(<InfoTooltip label="Leverage" content={<span>(a) / (b)</span>} />)
    const trigger = screen.getByRole('button', { name: 'Leverage' })
    fireEvent.click(trigger)
    expect(screen.getByRole('tooltip')).toHaveTextContent('(a) / (b)')
    fireEvent.click(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
