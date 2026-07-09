import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ValueSkeleton } from '../ValueSkeleton'

describe('<ValueSkeleton />', () => {
  it('exposes a status role with a default label', () => {
    render(<ValueSkeleton />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('applies a custom label and width', () => {
    render(<ValueSkeleton ariaLabel="Loading balance" width={120} />)
    const bar = screen.getByRole('status', { name: 'Loading balance' })
    expect(bar).toHaveStyle({ width: '120px' })
  })
})
