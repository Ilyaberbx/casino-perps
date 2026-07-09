import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toast } from '../Toast'
import type { ToastRecord } from '@/modules/shared/services/toast'

function buildRecord(overrides: Partial<ToastRecord> = {}): ToastRecord {
  return {
    id: 'r1',
    variant: 'success',
    title: 'Done',
    durationMs: 5000,
    createdAt: 0,
    ...overrides,
  }
}

describe('Toast', () => {
  it.each(['success', 'error', 'info', 'warning'] as const)(
    'renders %s variant with data-variant attribute',
    (variant) => {
      render(
        <Toast
          record={buildRecord({ variant, id: variant })}
          isExiting={false}
          onDismiss={() => {}}
        />,
      )
      const node = screen.getByTestId(`toast-${variant}`)
      expect(node.getAttribute('data-variant')).toBe(variant)
    },
  )

  it('uses aria-live="assertive" for error variant', () => {
    render(
      <Toast record={buildRecord({ variant: 'error' })} isExiting={false} onDismiss={() => {}} />,
    )
    const node = screen.getByTestId('toast-r1')
    expect(node.getAttribute('aria-live')).toBe('assertive')
  })

  it('uses aria-live="polite" for non-error variants', () => {
    render(
      <Toast record={buildRecord({ variant: 'success' })} isExiting={false} onDismiss={() => {}} />,
    )
    const node = screen.getByTestId('toast-r1')
    expect(node.getAttribute('aria-live')).toBe('polite')
  })

  it('reflects exit state via data-state', () => {
    const { rerender } = render(
      <Toast record={buildRecord({ id: 'x' })} isExiting={false} onDismiss={() => {}} />,
    )
    expect(screen.getByTestId('toast-x').getAttribute('data-state')).toBe('visible')
    rerender(<Toast record={buildRecord({ id: 'x' })} isExiting onDismiss={() => {}} />)
    expect(screen.getByTestId('toast-x').getAttribute('data-state')).toBe('exiting')
  })

  it('renders title and description', () => {
    render(
      <Toast
        record={buildRecord({ title: 'Hello', description: 'World' })}
        isExiting={false}
        onDismiss={() => {}}
      />,
    )
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('World')).toBeInTheDocument()
  })

  it('fires onDismiss when the toast surface is clicked', async () => {
    const onDismiss = vi.fn()
    render(<Toast record={buildRecord({ id: 'x' })} isExiting={false} onDismiss={onDismiss} />)
    await userEvent.click(screen.getByTestId('toast-x'))
    expect(onDismiss).toHaveBeenCalledWith('x')
  })

  it('renders action button and fires its onClick', async () => {
    const onClick = vi.fn()
    render(
      <Toast
        record={buildRecord({ action: { label: 'Retry', onClick } })}
        isExiting={false}
        onDismiss={() => {}}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onClick).toHaveBeenCalled()
  })

  it('does not dismiss when the action button is clicked', async () => {
    const onDismiss = vi.fn()
    render(
      <Toast
        record={buildRecord({ action: { label: 'Retry', onClick: () => {} } })}
        isExiting={false}
        onDismiss={onDismiss}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
