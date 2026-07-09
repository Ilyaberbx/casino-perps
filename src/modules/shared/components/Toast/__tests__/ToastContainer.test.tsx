import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToastContainer } from '../ToastContainer'
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

describe('ToastContainer', () => {
  // Regression: an open Sheet sets `inert` on #root; a toast rendered inside
  // #root would inherit that inertness and its close/action buttons would stop
  // responding even though it paints on top (--z-toast > --z-sheet). Portaling
  // the viewport to document.body keeps it interactive over any overlay.
  it('portals the viewport to document.body, outside the local render tree', () => {
    const { container } = render(
      <ToastContainer records={[buildRecord()]} exitingIds={new Set()} onDismiss={() => {}} />,
    )
    const viewport = screen.getByTestId('toast-container')
    expect(viewport.parentElement).toBe(document.body)
    expect(container).not.toContainElement(viewport)
  })

  it('renders nothing when there are no records', () => {
    render(<ToastContainer records={[]} exitingIds={new Set()} onDismiss={() => {}} />)
    expect(screen.queryByTestId('toast-container')).toBeNull()
  })
})
