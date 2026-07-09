import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PnlCardStepper } from '../PnlCardStepper'

describe('PnlCardStepper', () => {
  it('renders the label + value and exposes per-arrow aria-labels', () => {
    render(
      <PnlCardStepper label="Planet" value="Saturn" ariaLabel="Choose the card planet" onStep={vi.fn()} />,
    )
    expect(screen.getByText('Planet')).toBeInTheDocument()
    expect(screen.getByText('Saturn')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Choose the card planet' })).toBeInTheDocument()
    expect(screen.getByLabelText('Previous Planet')).toBeInTheDocument()
    expect(screen.getByLabelText('Next Planet')).toBeInTheDocument()
  })

  it('calls onStep(-1) when the previous arrow is clicked', async () => {
    const onStep = vi.fn()
    render(<PnlCardStepper label="Planet" value="Saturn" ariaLabel="Choose the card planet" onStep={onStep} />)
    await userEvent.click(screen.getByLabelText('Previous Planet'))
    expect(onStep).toHaveBeenCalledExactlyOnceWith(-1)
  })

  it('calls onStep(1) when the next arrow is clicked', async () => {
    const onStep = vi.fn()
    render(<PnlCardStepper label="Mascot" value="Dino" ariaLabel="Choose the card mascot" onStep={onStep} />)
    await userEvent.click(screen.getByLabelText('Next Mascot'))
    expect(onStep).toHaveBeenCalledExactlyOnceWith(1)
  })
})
