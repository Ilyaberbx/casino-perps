import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RowsSkeleton } from '../RowsSkeleton'

describe('RowsSkeleton', () => {
  it('renders the requested number of shimmer rows under a status role', () => {
    render(<RowsSkeleton rows={7} />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-label', 'Loading')
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(7)
  })

  it('applies a forwarded className to the container so it can fill its panel', () => {
    render(<RowsSkeleton rows={3} className="panel-fill" />)
    expect(screen.getByRole('status')).toHaveClass('panel-fill')
  })
})
