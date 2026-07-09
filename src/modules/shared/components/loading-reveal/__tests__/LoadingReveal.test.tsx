import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { LoadingReveal } from '../LoadingReveal'
import { LOADING_REVEAL_EXIT_MS } from '../loading-reveal.constants'

const skeleton = <div data-testid="skeleton">loading…</div>
const content = <div data-testid="content">loaded</div>

afterEach(() => {
  vi.useRealTimers()
})

describe('LoadingReveal', () => {
  it('renders the skeleton and not the content while loading', () => {
    render(
      <LoadingReveal isLoading skeleton={skeleton}>
        {content}
      </LoadingReveal>,
    )
    expect(screen.getByTestId('skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('content')).not.toBeInTheDocument()
  })

  it('renders the content once loaded', () => {
    render(
      <LoadingReveal isLoading={false} skeleton={skeleton}>
        {content}
      </LoadingReveal>,
    )
    expect(screen.getByTestId('content')).toBeInTheDocument()
  })

  it('keeps a crossfading skeleton mounted briefly after the load flip, then drops it', () => {
    vi.useFakeTimers()
    const { rerender } = render(
      <LoadingReveal isLoading skeleton={skeleton}>
        {content}
      </LoadingReveal>,
    )
    // Flip from loading → loaded: content appears, and the exiting skeleton stays
    // mounted for the crossfade window (two skeletons: none in-flow + the overlay).
    rerender(
      <LoadingReveal isLoading={false} skeleton={skeleton}>
        {content}
      </LoadingReveal>,
    )
    expect(screen.getByTestId('content')).toBeInTheDocument()
    expect(screen.getByTestId('skeleton')).toBeInTheDocument()

    // After the exit window the crossfade skeleton is gone.
    act(() => {
      vi.advanceTimersByTime(LOADING_REVEAL_EXIT_MS + 10)
    })
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument()
    expect(screen.getByTestId('content')).toBeInTheDocument()
  })
})
