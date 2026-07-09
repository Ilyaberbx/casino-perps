import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentWorkingLoader } from '../AgentWorkingLoader'
import { AGENT_WORKING_COPY } from '../perp-suggestion-sheet.constants'

describe('AgentWorkingLoader', () => {
  it('renders the working copy with the selected agent label', () => {
    render(
      <AgentWorkingLoader iconKind="minara" agentLabel="Minara" animated />,
    )
    const status = screen.getByTestId('agent-working')
    expect(status).toHaveTextContent('Minara')
    expect(status).toHaveTextContent(AGENT_WORKING_COPY)
  })

  it('exposes a polite live-status region', () => {
    render(
      <AgentWorkingLoader iconKind="minara" agentLabel="Minara" animated />,
    )
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('renders the selected agent icon — Minara mark for Minara', () => {
    render(
      <AgentWorkingLoader iconKind="minara" agentLabel="Minara" animated />,
    )
    expect(screen.getByAltText('Minara')).toBeInTheDocument()
  })

  it('renders the three-eye motif for the Native agent', () => {
    render(
      <AgentWorkingLoader
        iconKind="three-eye"
        agentLabel="Native Agent"
        animated={false}
      />,
    )
    expect(screen.getByRole('img', { name: 'AI agent' })).toBeInTheDocument()
  })

  it('runs the animated GIF frame when animated is true', () => {
    const { container } = render(
      <AgentWorkingLoader iconKind="three-eye" agentLabel="Native Agent" animated />,
    )
    expect(screen.queryByRole('img', { name: 'AI agent' })).not.toBeInTheDocument()
    expect(container.querySelector('img[aria-hidden="true"]')).toBeInTheDocument()
  })

  it('shows the static frame when animated is false (reduced-motion)', () => {
    render(
      <AgentWorkingLoader
        iconKind="three-eye"
        agentLabel="Native Agent"
        animated={false}
      />,
    )
    expect(screen.getByRole('img', { name: 'AI agent' })).toBeInTheDocument()
  })
})
