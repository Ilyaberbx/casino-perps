import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Order, PerpPositionSnapshot } from '@/modules/shared/domain'
import { PositionTpslDialog } from '../PositionTpslDialog'

const POSITION: PerpPositionSnapshot = {
  symbol: 'BTC-PERP',
  side: 'long',
  size: 2,
  entryPrice: 60_000,
  markPrice: 61_000,
  positionValueUsd: 122_000,
  unrealizedPnlUsd: 0,
  roePct: 0,
  leverage: 10,
  leverageType: 'cross',
  liquidationPrice: null,
  marginUsedUsd: 0,
}

function restingOrder(overrides: Partial<Order> = {}): Order {
  return {
    identifier: 'oid-1',
    symbol: 'BTC-PERP',
    side: 'sell',
    size: 2,
    price: 70_000,
    filledSize: 0,
    status: 'open',
    orderType: 'market',
    timestamp: 0,
    reduceOnly: true,
    isPositionTpsl: true,
    triggerPrice: 70_000,
    triggerKind: 'tp',
    ...overrides,
  }
}

function setup(restingOrders: ReadonlyArray<Order> = []) {
  const onClose = vi.fn()
  const onSubmit = vi.fn()
  const onCancelOrder = vi.fn()
  render(
    <PositionTpslDialog
      position={POSITION}
      restingOrders={restingOrders}
      isMobile={false}
      onClose={onClose}
      onSubmit={onSubmit}
      onCancelOrder={onCancelOrder}
    />,
  )
  return { onClose, onSubmit, onCancelOrder }
}

describe('PositionTpslDialog', () => {
  it('renders the info rows with the position figures', () => {
    setup()
    expect(screen.getByText('Entry Price')).toBeInTheDocument()
    expect(screen.getByText('Mark Price')).toBeInTheDocument()
    expect(screen.getByText('+2 BTC')).toBeInTheDocument()
  })

  it('disables Create until a leg is populated, then submits', async () => {
    const user = userEvent.setup()
    const { onSubmit } = setup()
    const button = screen.getByRole('button', { name: 'Create TP/SL orders' })
    expect(button).toBeDisabled()
    await user.type(screen.getByLabelText('TP Price'), '70000')
    expect(button).toBeEnabled()
    await user.click(button)
    expect(onSubmit).toHaveBeenCalledWith('BTC-PERP', {
      takeProfit: { kind: 'take-profit', trigger: { type: 'price', price: 70_000 } },
    })
  })

  it('reveals the amount + limit blocks when their checkboxes are ticked', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByLabelText('Configure Amount'))
    expect(screen.getByLabelText('Use max amount')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Limit Price'))
    expect(screen.getByLabelText('Limit price')).toBeInTheDocument()
  })

  it('shows the empty state on the Orders tab when there are no resting orders', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Orders' }))
    expect(screen.getByText('No TP/SL orders found')).toBeInTheDocument()
  })

  it('lists resting orders on the Orders tab and cancels through the callback', async () => {
    const user = userEvent.setup()
    const { onCancelOrder } = setup([restingOrder({ identifier: 'oid-9', triggerKind: 'tp' })])
    await user.click(screen.getByRole('button', { name: 'Orders' }))
    expect(screen.getByText('Take Profit')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel Take Profit order' }))
    expect(onCancelOrder).toHaveBeenCalledWith('oid-9')
  })
})
