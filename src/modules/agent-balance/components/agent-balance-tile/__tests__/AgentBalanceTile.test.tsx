import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync, globSync } from 'node:fs'
import { resolve } from 'node:path'
import type { AgentBalanceTileViewModel } from '../../../agent-balance.types'

const useAgentBalanceTileMock = vi.fn<() => AgentBalanceTileViewModel>()

vi.mock('../use-agent-balance-tile', () => ({
  useAgentBalanceTile: () => useAgentBalanceTileMock(),
}))

// The actions sub-component reads the sheet provider; stub it so the tile test
// asserts the metric body in isolation (the actions have their own test).
vi.mock('../../agent-balance-actions', () => ({
  AgentBalanceActions: () => <div data-testid="agent-balance-actions" />,
}))

import { AgentBalanceTile } from '../AgentBalanceTile'

describe('AgentBalanceTile', () => {
  it('renders the Agent Balance label and the hook display string', () => {
    useAgentBalanceTileMock.mockReturnValue({ display: '$12.50', status: 'ready' })
    render(<AgentBalanceTile />)
    expect(screen.getByLabelText(/agent balance/i)).toBeInTheDocument()
    expect(screen.getByText('$12.50')).toBeInTheDocument()
  })

  it('renders the empty placeholder string the hook returns when disconnected', () => {
    useAgentBalanceTileMock.mockReturnValue({ display: '$0.00', status: 'idle' })
    render(<AgentBalanceTile />)
    expect(screen.getByText('$0.00')).toBeInTheDocument()
  })

  it('renders a loading skeleton (not the pre-read $0.00) while the read is in flight', () => {
    useAgentBalanceTileMock.mockReturnValue({ display: '$0.00', status: 'loading' })
    render(<AgentBalanceTile />)
    expect(screen.getByRole('status', { name: /loading agent balance/i })).toBeInTheDocument()
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument()
  })

  it('renders an explicit "Unavailable" (never the misleading $0.00) on a failed read', () => {
    useAgentBalanceTileMock.mockReturnValue({ display: '$0.00', status: 'error' })
    render(<AgentBalanceTile />)
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument()
  })
})

describe('agent-balance module isolation', () => {
  it('never imports a venue-provider (venue-independent)', () => {
    // Resolve from the Vitest cwd (the @perps/client app dir) so the source
    // scan works regardless of how `import.meta.url` is rewritten by the
    // transform — the module path is the stable anchor.
    const moduleRoot = resolve(process.cwd(), 'src/modules/agent-balance')
    const files = globSync('**/*.{ts,tsx}', { cwd: moduleRoot })
    const sources = files
      .filter((f) => !f.includes('__tests__') && !f.includes('__fixtures__'))
      .map((f) => readFileSync(`${moduleRoot}/${f}`, 'utf8'))
    const mentionsVenue = sources.some(
      (src) =>
        src.includes('venue-provider') ||
        src.includes('useVenue') ||
        src.includes('useCapability'),
    )
    expect(mentionsVenue).toBe(false)
  })
})
