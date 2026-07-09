import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FitCell } from '../FitCell'

/**
 * jsdom never lays out, so the hook always derives scale 1 here. These tests
 * pin the dumb component's contract: it renders its children, exposes the scale
 * as the `--fit-scale` CSS var, reflects `align` for the transform-origin, and
 * passes `className` / `title` through. The scale *math* is covered by
 * `use-fit-cell.test.tsx`; a stub observer keeps the component isolated.
 */
beforeEach(() => {
  class NoopResizeObserver {
    observe(): void {}
    disconnect(): void {}
    unobserve(): void {}
  }
  vi.stubGlobal('ResizeObserver', NoopResizeObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('FitCell', () => {
  it('renders its children', () => {
    render(<FitCell>12,345.67</FitCell>)
    expect(screen.getByText('12,345.67')).toBeInTheDocument()
  })

  it('exposes the scale as the --fit-scale custom property on the inner element', () => {
    render(<FitCell>123</FitCell>)
    const inner = screen.getByText('123')
    // jsdom lays out to zero, so the hook derives the no-compression default.
    expect(inner.style.getPropertyValue('--fit-scale')).toBe('1')
  })

  it('anchors the transform to the right edge by default', () => {
    render(<FitCell>123</FitCell>)
    expect(screen.getByText('123').dataset.fitAlign).toBe('right')
  })

  it('anchors the transform to the left edge when align="left"', () => {
    render(<FitCell align="left">123</FitCell>)
    expect(screen.getByText('123').dataset.fitAlign).toBe('left')
  })

  it('passes className through to the outer element', () => {
    render(<FitCell className="dense-cell">123</FitCell>)
    const inner = screen.getByText('123')
    const outer = inner.parentElement
    expect(outer).not.toBeNull()
    expect(outer?.classList.contains('dense-cell')).toBe(true)
  })

  it('passes title through to the outer element', () => {
    render(<FitCell title="12,345.6789">12,345.68</FitCell>)
    const outer = screen.getByText('12,345.68').parentElement
    expect(outer?.getAttribute('title')).toBe('12,345.6789')
  })
})
