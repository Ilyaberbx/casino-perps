import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IconSelect } from '../IconSelect'
import type { IconSelectOption } from '../icon-select.types'

const options: IconSelectOption[] = [
  { value: 'mock', label: 'Mock', icon: <span data-testid="i-mock">M</span> },
  { value: 'hyperliquid', label: 'Hyperliquid', icon: <span data-testid="i-hl">H</span> },
]

const withDisabled: IconSelectOption[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo', disabled: true },
  { value: 'c', label: 'Charlie' },
]

function setup(value = 'mock') {
  const onChange = vi.fn()
  render(<IconSelect options={options} value={value} onChange={onChange} ariaLabel="Select Venue" />)
  return { onChange }
}

describe('<IconSelect />', () => {
  it('renders the selected option label + icon on the trigger', () => {
    setup('hyperliquid')
    const trigger = screen.getByRole('button', { name: 'Select Venue' })
    expect(trigger).toHaveTextContent('Hyperliquid')
    expect(screen.getByTestId('i-hl')).toBeInTheDocument()
  })

  it('is closed by default (no listbox)', () => {
    setup()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('opens the listbox on trigger click', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Select Venue' }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  it('marks the current value as aria-selected', async () => {
    const user = userEvent.setup()
    setup('hyperliquid')
    await user.click(screen.getByRole('button', { name: 'Select Venue' }))
    expect(screen.getByRole('option', { name: /Hyperliquid/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('selects an option on click and closes', async () => {
    const user = userEvent.setup()
    const { onChange } = setup()
    await user.click(screen.getByRole('button', { name: 'Select Venue' }))
    await user.click(screen.getByRole('option', { name: /Hyperliquid/ }))
    expect(onChange).toHaveBeenCalledWith('hyperliquid')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('navigates with arrow keys and selects with Enter', async () => {
    const user = userEvent.setup()
    const { onChange } = setup()
    await user.click(screen.getByRole('button', { name: 'Select Venue' }))
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith('hyperliquid')
  })

  it('closes on Escape without selecting', async () => {
    const user = userEvent.setup()
    const { onChange } = setup()
    await user.click(screen.getByRole('button', { name: 'Select Venue' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('type-ahead jumps the active option', async () => {
    const user = userEvent.setup()
    const { onChange } = setup()
    await user.click(screen.getByRole('button', { name: 'Select Venue' }))
    await user.keyboard('h{Enter}')
    expect(onChange).toHaveBeenCalledWith('hyperliquid')
  })

  it('exposes aria-activedescendant on the listbox', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Select Venue' }))
    const listbox = screen.getByRole('listbox')
    const active = listbox.getAttribute('aria-activedescendant')
    expect(active).toBeTruthy()
    expect(document.getElementById(active as string)).toHaveAttribute('role', 'option')
  })

  it('marks a disabled option aria-disabled and never selects it on click', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<IconSelect options={withDisabled} value="a" onChange={onChange} ariaLabel="Pick" />)
    await user.click(screen.getByRole('button', { name: 'Pick' }))
    const bravo = screen.getByRole('option', { name: /Bravo/ })
    expect(bravo).toHaveAttribute('aria-disabled', 'true')
    await user.click(bravo)
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('skips a disabled option during arrow navigation', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<IconSelect options={withDisabled} value="a" onChange={onChange} ariaLabel="Pick" />)
    await user.click(screen.getByRole('button', { name: 'Pick' }))
    // Active starts on Alpha (index 0); ArrowDown skips disabled Bravo → Charlie.
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith('c')
  })

  it('omits the icon slot when options provide no icon (label-only dropdown)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const labelOnly: IconSelectOption[] = [
      { value: '0.01', label: '0.01' },
      { value: '0.1', label: '0.1' },
    ]
    const { container } = render(
      <IconSelect options={labelOnly} value="0.01" onChange={onChange} ariaLabel="Tick" />,
    )
    // Trigger: no icon span rendered.
    const trigger = screen.getByRole('button', { name: 'Tick' })
    expect(trigger.querySelector('[class*="icon"]')).toBeNull()
    // List rows: no icon spans either.
    await user.click(trigger)
    const iconSpans = container.querySelectorAll('[role="option"] [class*="icon"]')
    expect(iconSpans).toHaveLength(0)
  })
})
