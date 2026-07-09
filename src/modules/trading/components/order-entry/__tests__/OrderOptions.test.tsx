import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrderOptions } from '../OrderOptions'

const BASE_PROPS = {
  showReduceOnly: true,
  reduceOnly: false,
  onReduceOnlyChange: () => {},
  isLimit: false,
  timeInForce: 'Gtc' as const,
  onTimeInForceChange: () => {},
  isTwap: false,
  randomize: false,
  onRandomizeChange: () => {},
}

describe('OrderOptions', () => {
  it('toggles reduce-only', async () => {
    const onReduceOnlyChange = vi.fn()
    render(<OrderOptions {...BASE_PROPS} onReduceOnlyChange={onReduceOnlyChange} />)
    await userEvent.click(screen.getByRole('checkbox', { name: /reduce only/i }))
    expect(onReduceOnlyChange).toHaveBeenCalledWith(true)
  })

  it('hides the reduce-only toggle when showReduceOnly is false (spot)', () => {
    render(<OrderOptions {...BASE_PROPS} showReduceOnly={false} />)
    expect(screen.queryByRole('checkbox', { name: /reduce only/i })).not.toBeInTheDocument()
  })

  it('hides the TIF dropdown in market mode and shows it in limit mode', () => {
    const { rerender } = render(<OrderOptions {...BASE_PROPS} isLimit={false} />)
    expect(screen.queryByRole('button', { name: /time in force/i })).not.toBeInTheDocument()

    rerender(<OrderOptions {...BASE_PROPS} isLimit />)
    const trigger = screen.getByRole('button', { name: /time in force/i })
    expect(trigger).toBeInTheDocument()
    // Trigger reflects the current value's label.
    expect(trigger).toHaveTextContent('GTC')
  })

  it('selects a time-in-force from the dropdown', async () => {
    const onTimeInForceChange = vi.fn()
    render(<OrderOptions {...BASE_PROPS} isLimit onTimeInForceChange={onTimeInForceChange} />)
    await userEvent.click(screen.getByRole('button', { name: /time in force/i }))
    await userEvent.click(screen.getByRole('option', { name: 'IOC' }))
    expect(onTimeInForceChange).toHaveBeenCalledWith('Ioc')
  })

  it('hides Randomize outside twap mode and shows it in twap mode', () => {
    const { rerender } = render(<OrderOptions {...BASE_PROPS} isTwap={false} />)
    expect(screen.queryByRole('checkbox', { name: /randomize/i })).not.toBeInTheDocument()

    rerender(<OrderOptions {...BASE_PROPS} isTwap />)
    expect(screen.getByRole('checkbox', { name: /randomize/i })).toBeInTheDocument()
  })

  it('toggles Randomize in twap mode', async () => {
    const onRandomizeChange = vi.fn()
    render(<OrderOptions {...BASE_PROPS} isTwap onRandomizeChange={onRandomizeChange} />)
    await userEvent.click(screen.getByRole('checkbox', { name: /randomize/i }))
    expect(onRandomizeChange).toHaveBeenCalledWith(true)
  })

  it('reflects the randomize checked state', () => {
    render(<OrderOptions {...BASE_PROPS} isTwap randomize />)
    expect(screen.getByRole('checkbox', { name: /randomize/i })).toBeChecked()
  })
})
