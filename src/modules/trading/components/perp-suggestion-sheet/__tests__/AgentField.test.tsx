import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fireEvent } from '@testing-library/react'
import { AgentField } from '../AgentField'
import { MINARA_AGENT } from '../ai-agents.constants'
import { makeFakeParamForm, makeParamFormValues } from '../__fixtures__/suggestions'
import type {
  MarketFieldSchema,
  SelectFieldSchema,
  SliderFieldSchema,
} from '../ai-agents.types'

const marketField = MINARA_AGENT.fields[0] as MarketFieldSchema
const marginField = MINARA_AGENT.fields[1] as SliderFieldSchema
const leverageField = MINARA_AGENT.fields[2] as SliderFieldSchema
const styleField = MINARA_AGENT.fields[3] as SelectFieldSchema

describe('AgentField — market kind', () => {
  it('renders the searchable token list with a row per offered token', () => {
    const form = makeFakeParamForm()
    render(<AgentField field={marketField} form={form} />)
    expect(screen.getByTestId('token-search')).toBeInTheDocument()
    // The list is a combobox — focus the searchbar to open the dropdown.
    fireEvent.focus(screen.getByTestId('token-search'))
    form.tokens.forEach((token) => {
      expect(screen.getByTestId(`token-${token.symbol}`)).toBeInTheDocument()
    })
  })

  it('writes the chosen symbol through the view-model setSymbol', async () => {
    const user = userEvent.setup()
    const setSymbol = vi.fn()
    const form = makeFakeParamForm({ setSymbol })
    render(<AgentField field={marketField} form={form} />)
    fireEvent.focus(screen.getByTestId('token-search'))
    await user.click(screen.getByTestId('token-ETH'))
    expect(setSymbol).toHaveBeenCalledWith('ETH')
  })
})

describe('AgentField — slider kind', () => {
  it('renders the margin slider showing the formatted USD value', () => {
    const form = makeFakeParamForm({ values: makeParamFormValues({ marginUsd: '250' }) })
    render(<AgentField field={marginField} form={form} />)
    expect(screen.getByText('$250')).toBeInTheDocument()
  })

  it('caps the margin slider max at the view-model marginMax (collateral source)', () => {
    const form = makeFakeParamForm({ marginMax: 333 })
    render(<AgentField field={marginField} form={form} />)
    expect(screen.getByTestId('field-marginUsd')).toHaveAttribute('max', '333')
  })

  it('renders the leverage slider showing the x-suffixed value and caps at leverageMax', () => {
    const form = makeFakeParamForm({
      leverageMax: 20,
      values: makeParamFormValues({ leverage: '12' }),
    })
    render(<AgentField field={leverageField} form={form} />)
    expect(screen.getByText('12x')).toBeInTheDocument()
    expect(screen.getByTestId('field-leverage')).toHaveAttribute('max', '20')
  })

  it('writes the slider value through setMarginUsd', () => {
    const setMarginUsd = vi.fn()
    const form = makeFakeParamForm({ setMarginUsd })
    render(<AgentField field={marginField} form={form} />)
    fireEvent.change(screen.getByTestId('field-marginUsd'), { target: { value: '400' } })
    expect(setMarginUsd).toHaveBeenCalledWith('400')
  })

  it('writes the slider value through setLeverage', () => {
    const setLeverage = vi.fn()
    const form = makeFakeParamForm({ setLeverage })
    render(<AgentField field={leverageField} form={form} />)
    fireEvent.change(screen.getByTestId('field-leverage'), { target: { value: '15' } })
    expect(setLeverage).toHaveBeenCalledWith('15')
  })

  it('renders a field-tagged issue inline under the slider once the field is touched', () => {
    const form = makeFakeParamForm({
      issues: [{ field: 'marginUsd', message: 'Margin exceeds available collateral ($100.00)' }],
      touched: { marginUsd: true },
    })
    render(<AgentField field={marginField} form={form} />)
    const issue = screen.getByTestId('issue-marginUsd')
    expect(issue).toHaveTextContent('Margin exceeds available collateral ($100.00)')
  })

  it('hides the inline issue while the field is untouched (pristine $0 margin stays silent)', () => {
    const form = makeFakeParamForm({
      issues: [{ field: 'marginUsd', message: 'Enter a margin amount' }],
      touched: {},
    })
    render(<AgentField field={marginField} form={form} />)
    expect(screen.queryByTestId('issue-marginUsd')).not.toBeInTheDocument()
  })

  it('omits the inline issue when the field is clean', () => {
    const form = makeFakeParamForm({
      issues: [{ field: 'leverage', message: 'other field' }],
      touched: { marginUsd: true },
    })
    render(<AgentField field={marginField} form={form} />)
    expect(screen.queryByTestId('issue-marginUsd')).not.toBeInTheDocument()
  })
})

describe('AgentField — select kind', () => {
  it('renders the trading-style options', () => {
    const form = makeFakeParamForm()
    render(<AgentField field={styleField} form={form} />)
    expect(screen.getByRole('option', { name: 'Scalping' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Day trading' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Swing trading' })).toBeInTheDocument()
  })

  it('writes the chosen style through setStyle', async () => {
    const user = userEvent.setup()
    const setStyle = vi.fn()
    const form = makeFakeParamForm({ setStyle })
    render(<AgentField field={styleField} form={form} />)
    await user.selectOptions(screen.getByTestId('field-style'), 'swing-trading')
    expect(setStyle).toHaveBeenCalledWith('swing-trading')
  })
})
