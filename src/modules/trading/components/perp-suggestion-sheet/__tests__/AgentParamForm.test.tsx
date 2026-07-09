import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentParamForm } from '../AgentParamForm'
import { MINARA_AGENT, NATIVE_AGENT } from '../ai-agents.constants'
import { makeFakeParamForm } from '../__fixtures__/suggestions'

describe('AgentParamForm', () => {
  it('renders one field per schema entry for an agent with fields (Minara)', () => {
    render(<AgentParamForm agent={MINARA_AGENT} form={makeFakeParamForm()} />)
    expect(screen.getByTestId('agent-param-form')).toBeInTheDocument()
    expect(screen.getByTestId('token-search')).toBeInTheDocument()
    expect(screen.getByTestId('field-marginUsd')).toBeInTheDocument()
    expect(screen.getByTestId('field-leverage')).toBeInTheDocument()
    expect(screen.getByTestId('field-style')).toBeInTheDocument()
  })

  it('renders a coming-soon placeholder for a fieldless agent (Native)', () => {
    render(<AgentParamForm agent={NATIVE_AGENT} form={makeFakeParamForm()} />)
    const placeholder = screen.getByTestId('agent-coming-soon')
    expect(placeholder).toHaveTextContent('Native Agent is coming soon.')
    expect(screen.queryByTestId('agent-param-form')).not.toBeInTheDocument()
  })
})
