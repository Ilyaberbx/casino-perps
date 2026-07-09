import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { OrderIssue } from '@/modules/shared/domain'
import { EditableLegs } from '../EditableLegs'
import type { EditableLegsProps, PreviewEditState } from '../suggestion-preview.types'

const SEEDED: PreviewEditState = {
  marginUsd: '500',
  leverage: '5',
  entry: '60000',
  stopLoss: '58000',
  takeProfit: '65000',
}

function renderLegs(overrides: Partial<EditableLegsProps> = {}) {
  const props: EditableLegsProps = {
    edit: SEEDED,
    readOnly: false,
    issues: [],
    setMarginUsd: vi.fn(),
    setLeverage: vi.fn(),
    setEntry: vi.fn(),
    setStopLoss: vi.fn(),
    setTakeProfit: vi.fn(),
    ...overrides,
  }
  render(<EditableLegs {...props} />)
  return props
}

describe('EditableLegs', () => {
  it('renders the five inputs seeded with the edit-state values', () => {
    renderLegs()
    expect(screen.getByTestId('leg-margin')).toHaveValue(500)
    expect(screen.getByTestId('leg-leverage')).toHaveValue(5)
    expect(screen.getByTestId('leg-entry')).toHaveValue(60000)
    expect(screen.getByTestId('leg-stop-loss')).toHaveValue(58000)
    expect(screen.getByTestId('leg-take-profit')).toHaveValue(65000)
  })

  it('disables every input when readOnly', () => {
    renderLegs({ readOnly: true })
    expect(screen.getByTestId('leg-margin')).toBeDisabled()
    expect(screen.getByTestId('leg-leverage')).toBeDisabled()
    expect(screen.getByTestId('leg-entry')).toBeDisabled()
    expect(screen.getByTestId('leg-stop-loss')).toBeDisabled()
    expect(screen.getByTestId('leg-take-profit')).toBeDisabled()
  })

  it('leaves every input enabled when not readOnly', () => {
    renderLegs({ readOnly: false })
    expect(screen.getByTestId('leg-margin')).toBeEnabled()
    expect(screen.getByTestId('leg-take-profit')).toBeEnabled()
  })

  it('renders a size-tagged issue under the margin input', () => {
    const issues: readonly OrderIssue[] = [{ field: 'size', message: 'Not enough margin' }]
    renderLegs({ issues })
    const marginIssue = screen.getByTestId('leg-margin-issue')
    expect(marginIssue).toHaveTextContent('Not enough margin')
  })

  it('renders a price-tagged issue under the entry input', () => {
    const issues: readonly OrderIssue[] = [{ field: 'price', message: 'Price off tick' }]
    renderLegs({ issues })
    const entryIssue = screen.getByTestId('leg-entry-issue')
    expect(entryIssue).toHaveTextContent('Price off tick')
  })

  it('marks the affected input invalid via data-invalid', () => {
    const issues: readonly OrderIssue[] = [{ field: 'size', message: 'Not enough margin' }]
    renderLegs({ issues })
    expect(screen.getByTestId('leg-margin')).toHaveAttribute('data-invalid', 'true')
    expect(screen.getByTestId('leg-entry')).not.toHaveAttribute('data-invalid')
  })

  it('renders untagged issues in the issue list, not under a field', () => {
    const issues: readonly OrderIssue[] = [{ message: 'Reduce-only blocked' }]
    renderLegs({ issues })
    const list = screen.getByTestId('leg-issues')
    expect(list).toHaveTextContent('Reduce-only blocked')
    expect(screen.queryByTestId('leg-margin-issue')).not.toBeInTheDocument()
    expect(screen.queryByTestId('leg-entry-issue')).not.toBeInTheDocument()
  })

  it('renders no issue list when every issue is field-tagged', () => {
    const issues: readonly OrderIssue[] = [{ field: 'size', message: 'Not enough margin' }]
    renderLegs({ issues })
    expect(screen.queryByTestId('leg-issues')).not.toBeInTheDocument()
  })

  it('calls setMarginUsd with the new value when the margin input changes', async () => {
    const user = userEvent.setup()
    const props = renderLegs()
    await user.type(screen.getByTestId('leg-margin'), '9')
    expect(props.setMarginUsd).toHaveBeenCalledWith('5009')
  })

  it('calls setEntry with the new value when the entry input changes', async () => {
    const user = userEvent.setup()
    const props = renderLegs()
    await user.type(screen.getByTestId('leg-entry'), '1')
    expect(props.setEntry).toHaveBeenCalledWith('600001')
  })

  it('calls setStopLoss when the stop-loss input changes', async () => {
    const user = userEvent.setup()
    const props = renderLegs()
    await user.type(screen.getByTestId('leg-stop-loss'), '1')
    expect(props.setStopLoss).toHaveBeenCalledWith('580001')
  })

  it('calls setTakeProfit when the take-profit input changes', async () => {
    const user = userEvent.setup()
    const props = renderLegs()
    await user.type(screen.getByTestId('leg-take-profit'), '1')
    expect(props.setTakeProfit).toHaveBeenCalledWith('650001')
  })

  it('calls setLeverage when the leverage input changes', async () => {
    const user = userEvent.setup()
    const props = renderLegs()
    await user.type(screen.getByTestId('leg-leverage'), '0')
    expect(props.setLeverage).toHaveBeenCalledWith('50')
  })
})
