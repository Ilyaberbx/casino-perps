import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FlowErrorCallout } from '../FlowErrorCallout'

const styles = { track: 'track' }

describe('FlowErrorCallout', () => {
  it('renders the label, prose, and retry CTA', () => {
    render(
      <FlowErrorCallout
        styles={styles}
        label="Error"
        prose="You declined the request in your wallet."
        retryCta="Try again"
        onRetry={vi.fn()}
      />,
    )
    expect(screen.getByText('You declined the request in your wallet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('fires onRetry when the CTA is clicked', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(
      <FlowErrorCallout
        styles={styles}
        label="Error"
        prose="Something went wrong."
        retryCta="Try again"
        onRetry={onRetry}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
