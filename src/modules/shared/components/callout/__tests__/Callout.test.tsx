import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Callout } from '../Callout'

describe('Callout', () => {
  it('renders the label and prose for a warning', () => {
    render(
      <Callout variant="warning" label="Warning">
        Deposit only from a wallet you control.
      </Callout>,
    )

    expect(screen.getByText('Warning')).toBeInTheDocument()
    expect(screen.getByText('Deposit only from a wallet you control.')).toBeInTheDocument()
  })

  it('asserts (role="alert") for the error variant and is polite otherwise', () => {
    const { rerender } = render(
      <Callout variant="error" label="Error">
        Transfer failed.
      </Callout>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()

    rerender(
      <Callout variant="info" label="Heads up">
        You will need a little ETH for gas.
      </Callout>,
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
