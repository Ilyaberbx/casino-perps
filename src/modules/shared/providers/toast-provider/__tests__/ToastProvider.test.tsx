import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '../ToastProvider'
import { useToast } from '../use-toast'
import { TOAST_EXIT_MS } from '@/modules/shared/components/Toast'
import { toast } from '@/modules/shared/services/toast'
import { resetImperativeToastQueue } from '@/modules/shared/services/toast/__fixtures__/reset-imperative-toast-queue'

function HookProbe({ onReady }: { onReady: (api: ReturnType<typeof useToast>) => void }) {
  const api = useToast()
  onReady(api)
  return null
}

describe('ToastProvider', () => {
  beforeEach(() => {
    resetImperativeToastQueue()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a toast pushed via the hook api', () => {
    let api!: ReturnType<typeof useToast>
    render(
      <ToastProvider>
        <HookProbe onReady={(a) => { api = a }} />
      </ToastProvider>,
    )
    act(() => {
      api.show({ variant: 'success', title: 'Hello', id: 'h' })
    })
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('drains imperative queue events pushed before mount via toast.show', () => {
    act(() => {
      toast.show({ variant: 'info', title: 'Preflight', id: 'pre' })
    })
    render(<ToastProvider>{null}</ToastProvider>)
    expect(screen.getByText('Preflight')).toBeInTheDocument()
  })

  it('dedupes by id (replace, not stack)', () => {
    let api!: ReturnType<typeof useToast>
    render(
      <ToastProvider>
        <HookProbe onReady={(a) => { api = a }} />
      </ToastProvider>,
    )
    act(() => {
      api.show({ variant: 'info', title: 'First', id: 'k' })
      api.show({ variant: 'info', title: 'Second', id: 'k' })
    })
    expect(screen.queryAllByText('First')).toHaveLength(0)
    expect(screen.getAllByText('Second')).toHaveLength(1)
  })

  it('caps visible toasts at 4', () => {
    let api!: ReturnType<typeof useToast>
    render(
      <ToastProvider>
        <HookProbe onReady={(a) => { api = a }} />
      </ToastProvider>,
    )
    act(() => {
      for (let i = 0; i < 6; i += 1) {
        api.show({ variant: 'info', title: `T${i}`, id: `id-${i}` })
      }
    })
    const container = screen.getByTestId('toast-container')
    expect(container.children).toHaveLength(4)
  })

  it('auto-dismisses success after 7 seconds (plus the exit window)', () => {
    let api!: ReturnType<typeof useToast>
    render(
      <ToastProvider>
        <HookProbe onReady={(a) => { api = a }} />
      </ToastProvider>,
    )
    act(() => {
      api.show({ variant: 'success', title: 'S', id: 's' })
    })
    expect(screen.getByText('S')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(6999)
    })
    // Still visible a hair before the global 7s window elapses.
    expect(screen.getByTestId('toast-s').getAttribute('data-state')).toBe('visible')
    act(() => {
      vi.advanceTimersByTime(2)
    })
    // Auto-dismiss fired: the toast is now animating out, still mounted.
    expect(screen.getByTestId('toast-s').getAttribute('data-state')).toBe('exiting')
    act(() => {
      vi.advanceTimersByTime(TOAST_EXIT_MS)
    })
    expect(screen.queryByText('S')).toBeNull()
  })

  it('auto-dismisses warning after 7 seconds (plus the exit window)', () => {
    let api!: ReturnType<typeof useToast>
    render(
      <ToastProvider>
        <HookProbe onReady={(a) => { api = a }} />
      </ToastProvider>,
    )
    act(() => {
      api.show({ variant: 'warning', title: 'W', id: 'w' })
    })
    act(() => {
      vi.advanceTimersByTime(6999)
    })
    expect(screen.getByText('W')).toBeInTheDocument()
    expect(screen.getByTestId('toast-w').getAttribute('data-state')).toBe('visible')
    act(() => {
      vi.advanceTimersByTime(2)
    })
    expect(screen.getByTestId('toast-w').getAttribute('data-state')).toBe('exiting')
    act(() => {
      vi.advanceTimersByTime(TOAST_EXIT_MS)
    })
    expect(screen.queryByText('W')).toBeNull()
  })

  it('plays the exit animation before removing a manually dismissed toast', () => {
    let api!: ReturnType<typeof useToast>
    render(
      <ToastProvider>
        <HookProbe onReady={(a) => { api = a }} />
      </ToastProvider>,
    )
    act(() => {
      api.show({ variant: 'info', title: 'Bye', id: 'd' })
    })
    act(() => {
      api.dismiss('d')
    })
    expect(screen.getByTestId('toast-d').getAttribute('data-state')).toBe('exiting')
    act(() => {
      vi.advanceTimersByTime(TOAST_EXIT_MS)
    })
    expect(screen.queryByText('Bye')).toBeNull()
  })

  it('revives a re-shown toast that was mid-exit', () => {
    let api!: ReturnType<typeof useToast>
    render(
      <ToastProvider>
        <HookProbe onReady={(a) => { api = a }} />
      </ToastProvider>,
    )
    act(() => {
      api.show({ variant: 'info', title: 'Again', id: 'r' })
      api.dismiss('r')
    })
    expect(screen.getByTestId('toast-r').getAttribute('data-state')).toBe('exiting')
    act(() => {
      api.show({ variant: 'info', title: 'Again', id: 'r' })
    })
    expect(screen.getByTestId('toast-r').getAttribute('data-state')).toBe('visible')
    act(() => {
      vi.advanceTimersByTime(TOAST_EXIT_MS)
    })
    // The exit timer was cancelled — it stays mounted.
    expect(screen.getByText('Again')).toBeInTheDocument()
  })

  it('auto-dismisses error toasts after 7 seconds (no longer persistent)', () => {
    let api!: ReturnType<typeof useToast>
    render(
      <ToastProvider>
        <HookProbe onReady={(a) => { api = a }} />
      </ToastProvider>,
    )
    act(() => {
      api.show({ variant: 'error', title: 'Boom', id: 'e' })
    })
    expect(screen.getByText('Boom')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(6999)
    })
    // Errors now follow the global 7s window instead of staying forever.
    expect(screen.getByTestId('toast-e').getAttribute('data-state')).toBe('visible')
    act(() => {
      vi.advanceTimersByTime(2)
    })
    expect(screen.getByTestId('toast-e').getAttribute('data-state')).toBe('exiting')
    act(() => {
      vi.advanceTimersByTime(TOAST_EXIT_MS)
    })
    expect(screen.queryByText('Boom')).toBeNull()
  })

  it('action button onClick fires', async () => {
    vi.useRealTimers()
    let api!: ReturnType<typeof useToast>
    render(
      <ToastProvider>
        <HookProbe onReady={(a) => { api = a }} />
      </ToastProvider>,
    )
    const onClick = vi.fn()
    act(() => {
      api.show({
        variant: 'info',
        title: 'Has action',
        id: 'a',
        action: { label: 'Go', onClick },
      })
    })
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalled()
  })

  it('useToast throws outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<HookProbe onReady={() => {}} />)).toThrow(
      /useToast must be used inside <ToastProvider>/,
    )
    spy.mockRestore()
  })
})
