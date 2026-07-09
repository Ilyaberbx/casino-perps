import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { OrderTypeControl } from '../OrderTypeControl'
import type { OrderType } from '../order-entry.types'
import styles from '../order-entry.module.css'

function Harness({
  supportsStopOrders = false,
  supportsTwap = false,
  initialType = 'market',
  onChange,
}: {
  supportsStopOrders?: boolean
  supportsTwap?: boolean
  initialType?: OrderType
  onChange?: (orderType: OrderType) => void
}) {
  const [orderType, setOrderType] = useState<OrderType>(initialType)
  return (
    <OrderTypeControl
      orderType={orderType}
      supportsStopOrders={supportsStopOrders}
      supportsTwap={supportsTwap}
      onOrderTypeChange={(next) => {
        setOrderType(next)
        onChange?.(next)
      }}
    />
  )
}

describe('OrderTypeControl', () => {
  it('renders only Market | Limit when no Pro flag is set (3rd segment omitted)', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Market' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Limit' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pro/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /stop|twap/i })).not.toBeInTheDocument()
  })

  it('lists all Pro types in reference order (TWAP, Stop Limit, Stop Market) when both flags set', async () => {
    const user = userEvent.setup()
    render(<Harness supportsStopOrders supportsTwap />)
    await user.click(screen.getByRole('button', { name: /pro/i }))
    const options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual([
      'TWAP',
      'Stop Limit',
      'Stop Market',
    ])
  })

  it('filters the menu to only TWAP when only supportsTwap is set', async () => {
    const user = userEvent.setup()
    render(<Harness supportsTwap />)
    await user.click(screen.getByRole('button', { name: /pro/i }))
    const options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(['TWAP'])
  })

  it('filters the menu to only the two stop types when only supportsStopOrders is set', async () => {
    const user = userEvent.setup()
    render(<Harness supportsStopOrders />)
    await user.click(screen.getByRole('button', { name: /pro/i }))
    const options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(['Stop Limit', 'Stop Market'])
  })

  it('relabels the 3rd segment to the selected Pro type and emits the type', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness supportsStopOrders supportsTwap onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /^pro/i }))
    await user.click(screen.getByRole('option', { name: 'Stop Market' }))
    expect(onChange).toHaveBeenCalledWith('stop-market')
    expect(screen.getByRole('button', { name: /stop market/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^pro/i })).not.toBeInTheDocument()
  })

  it('reopens the menu from the relabeled segment', async () => {
    const user = userEvent.setup()
    render(<Harness supportsStopOrders supportsTwap initialType="twap" />)
    const trigger = screen.getByRole('button', { name: /twap/i })
    expect(trigger).toBeInTheDocument()
    await user.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('resets the 3rd segment to "Pro" when Market is chosen after a Pro type', async () => {
    const user = userEvent.setup()
    render(<Harness supportsStopOrders supportsTwap initialType="stop-limit" />)
    expect(screen.getByRole('button', { name: /stop limit/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Market' }))
    expect(screen.getByRole('button', { name: /^pro/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /stop limit/i })).not.toBeInTheDocument()
  })

  it('navigates options with arrow keys and selects with Enter', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness supportsStopOrders supportsTwap onChange={onChange} />)
    const trigger = screen.getByRole('button', { name: /^pro/i })
    trigger.focus()
    await user.keyboard('{ArrowDown}') // opens, active = TWAP (index 0)
    await user.keyboard('{ArrowDown}') // active = Stop Limit (index 1)
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('stop-limit')
  })

  // Mobile sheet pass (T14): on a narrow sheet the relabelled 3rd segment
  // ("Stop Market") must ellipsize, not wrap. The truncation is carried by the
  // `typeSegmentLabel` class (overflow:hidden + text-overflow:ellipsis +
  // min-width:0); pin that the relabelled segment renders its text through that
  // span so the CSS hook is present.
  it('wraps the relabelled Pro segment text in the truncation class', () => {
    render(<Harness supportsStopOrders supportsTwap initialType="stop-market" />)
    const trigger = screen.getByRole('button', { name: /stop market/i })
    const label = within(trigger).getByText('Stop Market')
    expect(label).toHaveClass(styles.typeSegmentLabel)
  })

  it('exposes the Pro trigger popup state via aria-expanded/haspopup/controls', async () => {
    const user = userEvent.setup()
    render(<Harness supportsStopOrders supportsTwap />)
    const trigger = screen.getByRole('button', { name: /^pro/i })
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).not.toHaveAttribute('aria-controls')
    await user.click(trigger)
    const listbox = screen.getByRole('listbox')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger).toHaveAttribute('aria-controls', listbox.id)
  })

  it('tracks the active option on the listbox via aria-activedescendant', async () => {
    const user = userEvent.setup()
    render(<Harness supportsStopOrders supportsTwap />)
    await user.click(screen.getByRole('button', { name: /^pro/i }))
    const listbox = screen.getByRole('listbox')
    const firstOption = within(listbox).getAllByRole('option')[0]
    expect(listbox).toHaveAttribute('aria-activedescendant', firstOption.id)
    await user.keyboard('{ArrowDown}')
    const secondOption = within(listbox).getAllByRole('option')[1]
    expect(listbox).toHaveAttribute('aria-activedescendant', secondOption.id)
  })

  it('closes the menu and returns focus to the trigger on Escape', async () => {
    const user = userEvent.setup()
    render(<Harness supportsStopOrders supportsTwap />)
    const trigger = screen.getByRole('button', { name: /^pro/i })
    await user.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
