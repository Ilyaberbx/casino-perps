import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppErrorBoundary } from '../AppErrorBoundary'

// Mock the logger singleton so we can assert the boundary reports the crash at
// `error` level (logging.md) without touching the console adapter. `@/app/logger`
// and the boundary's relative `../logger` resolve to the same module.
const { errorSpy } = vi.hoisted(() => ({ errorSpy: vi.fn() }))
vi.mock('@/app/logger', () => ({
  logger: {
    child: () => ({ error: errorSpy, warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
  },
}))

function Boom(): never {
  throw new Error('kaboom')
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    errorSpy.mockClear()
    // React logs the caught error to console.error in dev — silence it so the
    // suite output stays clean.
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when nothing throws', () => {
    render(
      <AppErrorBoundary>
        <p>all good</p>
      </AppErrorBoundary>,
    )
    expect(screen.getByText('all good')).toBeInTheDocument()
  })

  it('renders the crash screen and logs at error level when a child throws', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Something broke' })).toBeInTheDocument()
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ errorName: 'Error', errorMessage: 'kaboom' }),
      'render error',
    )
  })

  it('offers the Discord and X report CTAs as external links', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    )

    const discord = screen.getByRole('link', { name: /report on discord/i })
    expect(discord).toHaveAttribute('href', expect.stringContaining('discord.gg'))
    expect(discord).toHaveAttribute('target', '_blank')

    const x = screen.getByRole('link', { name: /contact on x/i })
    expect(x).toHaveAttribute('href', expect.stringContaining('x.com/invaderstrade'))
    expect(x).toHaveAttribute('target', '_blank')
  })
})
