import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TableSkeleton } from '../TableSkeleton'

describe('TableSkeleton', () => {
  it('renders rows × columns shimmer cells with the given grid template', () => {
    render(<TableSkeleton gridTemplate="var(--positions-grid)" columns={11} rows={4} />)
    const cells = screen.getAllByTestId('table-skeleton-cell')
    expect(cells).toHaveLength(11 * 4)
  })

  it('exposes a status role with an accessible loading label', () => {
    render(
      <TableSkeleton gridTemplate="1fr 1fr" columns={2} rows={3} ariaLabel="Loading positions" />,
    )
    expect(screen.getByRole('status', { name: /loading positions/i })).toBeInTheDocument()
  })

  it('defaults to six rows when rows is omitted', () => {
    render(<TableSkeleton gridTemplate="1fr 1fr 1fr" columns={3} />)
    expect(screen.getAllByTestId('table-skeleton-cell')).toHaveLength(3 * 6)
  })
})
