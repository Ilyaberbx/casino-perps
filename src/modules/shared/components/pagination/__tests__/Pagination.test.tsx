import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pagination } from '../Pagination'

function setup(overrides: Partial<Parameters<typeof Pagination>[0]> = {}) {
  const props = {
    page: 2,
    pageCount: 5,
    canPrev: true,
    canNext: true,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  }
  render(<Pagination {...props} />)
  return props
}

describe('Pagination', () => {
  it('marks the current page with aria-current', () => {
    setup({ page: 2, pageCount: 5 })
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: '1' })).not.toHaveAttribute('aria-current')
  })

  it('fires onPrev / onNext / onSelect', async () => {
    const props = setup({ page: 2, pageCount: 5 })
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await userEvent.click(screen.getByRole('button', { name: '4' }))
    expect(props.onPrev).toHaveBeenCalledTimes(1)
    expect(props.onNext).toHaveBeenCalledTimes(1)
    expect(props.onSelect).toHaveBeenCalledWith(4)
  })

  it('disables the arrows when navigation is not possible', () => {
    setup({ page: 1, pageCount: 1, canPrev: false, canNext: false })
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })
})
