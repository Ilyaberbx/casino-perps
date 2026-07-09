import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentPicker } from '../AgentPicker'
import { AI_AGENTS } from '../ai-agents.constants'
import { SOON_BADGE } from '../perp-suggestion-sheet.constants'
import type { AgentId } from '../ai-agents.types'

function renderPicker(selectedAgentId: AgentId = 'minara', onSelect = vi.fn()) {
  render(
    <AgentPicker
      agents={AI_AGENTS}
      selectedAgentId={selectedAgentId}
      onSelect={onSelect}
    />,
  )
  return onSelect
}

const openMenu = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Select AI agent' }))

describe('AgentPicker', () => {
  it('opens a dropdown listing every agent with its label', async () => {
    const user = userEvent.setup()
    renderPicker()
    await openMenu(user)
    expect(screen.getByRole('option', { name: /Minara/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Native Agent/ })).toBeInTheDocument()
  })

  it('shows the "soon" suffix on the Native (coming-soon) agent only', async () => {
    const user = userEvent.setup()
    renderPicker()
    await openMenu(user)
    expect(screen.getByRole('option', { name: /Native Agent/ })).toHaveTextContent(
      SOON_BADGE,
    )
    expect(screen.getByRole('option', { name: /Minara/ })).not.toHaveTextContent(
      SOON_BADGE,
    )
  })

  it('marks the Native agent option disabled and Minara enabled', async () => {
    const user = userEvent.setup()
    renderPicker()
    await openMenu(user)
    expect(screen.getByRole('option', { name: /Native Agent/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByRole('option', { name: /Minara/ })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('renders each agent option with its icon', async () => {
    const user = userEvent.setup()
    renderPicker()
    await openMenu(user)
    // Minara's mark is an <img alt="Minara">; the option row carries it.
    const option = screen.getByRole('option', { name: /Minara/ })
    expect(within(option).getByAltText('Minara')).toBeInTheDocument()
  })

  it('invokes onSelect when a different, enabled agent is chosen', async () => {
    const user = userEvent.setup()
    const onSelect = renderPicker('native')
    await openMenu(user)
    await user.click(screen.getByRole('option', { name: /Minara/ }))
    expect(onSelect).toHaveBeenCalledWith('minara')
  })

  it('does not invoke onSelect when the disabled Native agent is clicked', async () => {
    const user = userEvent.setup()
    const onSelect = renderPicker()
    await openMenu(user)
    await user.click(screen.getByRole('option', { name: /Native Agent/ }))
    expect(onSelect).not.toHaveBeenCalled()
  })
})
