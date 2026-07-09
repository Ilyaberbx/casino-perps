import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TwapBulkCancelConfirm } from '../TwapBulkCancelConfirm'

describe('TwapBulkCancelConfirm', () => {
  it('renders the count in the prompt and the confirm button', () => {
    render(
      <TwapBulkCancelConfirm isOpen isMobile={false} count={3} onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(screen.getByText(/cancel 3 selected twap orders\?/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel 3 twap orders/i })).toHaveTextContent('Cancel (3)')
  })

  it('uses the singular form for a single selection', () => {
    render(
      <TwapBulkCancelConfirm isOpen isMobile={false} count={1} onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(screen.getByText(/cancel 1 selected twap order\?/i)).toBeInTheDocument()
  })

  it('fires onConfirm when the destructive action is clicked', async () => {
    const onConfirm = vi.fn()
    render(
      <TwapBulkCancelConfirm isOpen isMobile={false} count={2} onConfirm={onConfirm} onCancel={() => {}} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /cancel 2 twap orders/i }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('fires onCancel when Keep is clicked', async () => {
    const onCancel = vi.fn()
    render(
      <TwapBulkCancelConfirm isOpen isMobile={false} count={2} onConfirm={() => {}} onCancel={onCancel} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /keep/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does not render content when closed', () => {
    render(
      <TwapBulkCancelConfirm isOpen={false} isMobile={false} count={2} onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(screen.queryByText(/selected twap order/i)).not.toBeInTheDocument()
  })
})
