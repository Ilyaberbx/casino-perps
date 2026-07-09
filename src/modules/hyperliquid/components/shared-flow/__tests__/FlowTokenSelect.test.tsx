import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FlowTokenSelect } from '../FlowTokenSelect'
import type { FlowTokenSelectStateCopy } from '../shared-flow.types'

const styles = { field: 'field', fieldLabel: 'fieldLabel' }
const STATE_COPY: FlowTokenSelectStateCopy = {
  loading: 'Loading assets…',
  error: "Couldn't load assets.",
  errorRetry: 'Retry',
  empty: 'No transferable assets in this account',
}
const TOKENS = [
  { key: 'usdc', symbol: 'USDC', available: 100 },
  { key: 'spot:HYPE', symbol: 'HYPE', available: 50 },
]

function renderSelect(
  overrides: Partial<Parameters<typeof FlowTokenSelect>[0]> = {},
) {
  return render(
    <FlowTokenSelect
      styles={styles}
      idPrefix="send"
      label="Asset"
      tokens={TOKENS}
      selectedTokenKey="usdc"
      status="ready"
      stateCopy={STATE_COPY}
      onSelect={vi.fn()}
      onRetry={vi.fn()}
      {...overrides}
    />,
  )
}

describe('FlowTokenSelect (custom dropdown)', () => {
  it('renders the selected token symbol on the closed trigger', () => {
    renderSelect()
    const trigger = screen.getByRole('button', { name: /Asset/ })
    expect(trigger).toHaveTextContent('USDC')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens a listbox of every token with symbol + available on click', async () => {
    const user = userEvent.setup()
    renderSelect()
    await user.click(screen.getByRole('button', { name: /Asset/ }))
    const listbox = screen.getByRole('listbox')
    const options = within(listbox).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual([
      'USDC · 100 available',
      'HYPE · 50 available',
    ])
  })

  it('selects a token with the keyboard (ArrowDown + Enter)', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    renderSelect({ onSelect })
    await user.click(screen.getByRole('button', { name: /Asset/ }))
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onSelect).toHaveBeenCalledWith('spot:HYPE')
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    renderSelect()
    const trigger = screen.getByRole('button', { name: /Asset/ })
    await user.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('selects a token by click', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    renderSelect({ onSelect })
    await user.click(screen.getByRole('button', { name: /Asset/ }))
    await user.click(screen.getByRole('option', { name: /HYPE/ }))
    expect(onSelect).toHaveBeenCalledWith('spot:HYPE')
  })

  it('shows a loading state instead of a dropdown', () => {
    renderSelect({ status: 'loading' })
    expect(screen.getByText('Loading assets…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Asset/ })).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no transferable assets', () => {
    renderSelect({ status: 'empty', tokens: [] })
    expect(
      screen.getByText('No transferable assets in this account'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Asset/ })).not.toBeInTheDocument()
  })

  it('shows an error state with a retry button that fires onRetry', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    renderSelect({ status: 'error', onRetry })
    expect(screen.getByText("Couldn't load assets.")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
