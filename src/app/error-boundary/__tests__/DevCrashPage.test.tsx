import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DevCrashPage } from '../DevCrashPage'

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/dev/crash${search}`]}>
      <DevCrashPage />
    </MemoryRouter>,
  )
}

describe('DevCrashPage', () => {
  beforeEach(() => {
    // A thrown render error logs to console.error in dev — silence it.
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the harness menu when no kind is set', () => {
    renderAt('')
    expect(screen.getByRole('heading', { name: 'Error boundary preview' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Render error' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /HTTP error/i })).toBeInTheDocument()
  })

  it('throws a generic render error for ?kind=error', () => {
    expect(() => renderAt('?kind=error')).toThrow(/accountValue/)
  })

  it('throws an ApiError carrying a request id for ?kind=http', () => {
    expect(() => renderAt('?kind=http')).toThrow(/failed: 500/)
  })
})
