import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { PreTradeSummary } from '../PreTradeSummary'
import type {
  LinearPreTradeEstimates,
  SlippageControl,
  TwapPreTradeEstimates,
} from '../order-entry.types'

// The pre-trade-estimate / twap utils were dissolved into the venue (ADR-0035);
// this component test builds its own TWAP estimate to render. The slice math
// mirrors the venue's: count = floor(runtimeSeconds / 30) + 1.
const TWAP_FREQUENCY_SECONDS = 30
function buildTwapEstimates(totalCoinSize: number, runtimeMinutes: number): TwapPreTradeEstimates {
  const numberOfOrders =
    runtimeMinutes > 0 ? Math.floor((runtimeMinutes * 60) / TWAP_FREQUENCY_SECONDS) + 1 : 0
  const sizePerSuborder = numberOfOrders > 0 ? totalCoinSize / numberOfOrders : 0
  return {
    kind: 'twap',
    notional: 0,
    frequencySeconds: TWAP_FREQUENCY_SECONDS,
    runtimeMinutes,
    numberOfOrders,
    sizePerSuborder,
    fee: 0,
    hasBuilderFee: false,
  }
}

function rowValue(label: RegExp): string {
  const row = screen.getByText(label).closest('div')
  if (row === null) throw new Error('row not found')
  return within(row).getAllByRole('definition')[0].textContent ?? ''
}

describe('PreTradeSummary — TWAP footer', () => {
  it('renders the TWAP rows driven by the estimate util (30m → 61 orders)', () => {
    render(
      <PreTradeSummary estimates={buildTwapEstimates(61, 30)} slippage={null} showLiquidation={false} />,
    )
    expect(rowValue(/^Frequency$/)).toBe('30 Seconds')
    expect(rowValue(/^Runtime$/)).toBe('30m')
    expect(rowValue(/^# Orders$/)).toBe('61')
    // 61 total / 61 orders → 1 per suborder.
    expect(rowValue(/^Size per Suborder$/)).toBe('1')
  })

  it('splits the total size across the sub-orders', () => {
    // 30.5 coin / 61 orders → 0.5 each.
    render(
      <PreTradeSummary estimates={buildTwapEstimates(30.5, 30)} slippage={null} showLiquidation={false} />,
    )
    expect(rowValue(/^# Orders$/)).toBe('61')
    expect(rowValue(/^Size per Suborder$/)).toBe('0.5')
  })

  it('does not render the linear order-value / liquidation rows', () => {
    render(
      <PreTradeSummary estimates={buildTwapEstimates(61, 30)} slippage={null} showLiquidation={false} />,
    )
    expect(screen.queryByText('Order Value')).not.toBeInTheDocument()
    expect(screen.queryByText('Liquidation Price')).not.toBeInTheDocument()
  })
})

describe('PreTradeSummary — slippage field accessibility', () => {
  const LINEAR_ESTIMATES: LinearPreTradeEstimates = {
    kind: 'linear',
    notional: 100,
    margin: 50,
    liquidationPrice: 0,
    fee: 0.1,
    hasBuilderFee: false,
  }
  const SLIPPAGE: SlippageControl = { value: '8', onChange: () => {} }

  it('uses the decimal input mode for the editable slippage field', () => {
    render(<PreTradeSummary estimates={LINEAR_ESTIMATES} slippage={SLIPPAGE} showLiquidation />)
    expect(screen.getByLabelText('Slippage tolerance percent')).toHaveAttribute(
      'inputmode',
      'decimal',
    )
  })
})

describe('PreTradeSummary — Liquidation Price row', () => {
  const FLAT_LINEAR: LinearPreTradeEstimates = {
    kind: 'linear',
    notional: 100,
    margin: 50,
    liquidationPrice: 0,
    fee: 0.1,
    hasBuilderFee: false,
  }
  const SLIPPAGE: SlippageControl = { value: '8', onChange: () => {} }

  it('shows Liquidation Price when showLiquidation is set, $0.00 when flat', () => {
    render(<PreTradeSummary estimates={FLAT_LINEAR} slippage={SLIPPAGE} showLiquidation />)
    expect(rowValue(/^Liquidation Price$/)).toBe('$0.00')
  })

  it('shows the real liquidation price when showLiquidation is set', () => {
    render(
      <PreTradeSummary
        estimates={{ ...FLAT_LINEAR, liquidationPrice: 1234.5 }}
        slippage={SLIPPAGE}
        showLiquidation
      />,
    )
    expect(rowValue(/^Liquidation Price$/)).toBe('$1,234.50')
  })

  it('hides Liquidation Price when showLiquidation is false (limit/stop or spot)', () => {
    render(
      <PreTradeSummary
        estimates={{ ...FLAT_LINEAR, liquidationPrice: 1234.5 }}
        slippage={SLIPPAGE}
        showLiquidation={false}
      />,
    )
    expect(screen.queryByText('Liquidation Price')).not.toBeInTheDocument()
  })
})
