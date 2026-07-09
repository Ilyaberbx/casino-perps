import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PerpPositionSnapshot } from '@/modules/shared/domain'
import { parseHip3Symbol } from '@/modules/shared/utils/hip3-symbol'
import { PositionsPanel } from '../PositionsPanel'
import type { PositionRowView } from '../account-dock.types'

function position(overrides: Partial<PerpPositionSnapshot> = {}): PerpPositionSnapshot {
  return {
    symbol: 'BTC-PERP',
    side: 'long',
    size: 4,
    entryPrice: 60_000,
    markPrice: 61_000,
    positionValueUsd: 244_000,
    unrealizedPnlUsd: 0,
    roePct: 0,
    leverage: 10,
    leverageType: 'cross',
    liquidationPrice: null,
    marginUsedUsd: 0,
    ...overrides,
  }
}

// Mirrors how `useAccountDock` enriches each position: parse the raw symbol once
// into the display parts the dumb row renders.
function row(
  overrides: Partial<PerpPositionSnapshot> = {},
  tpsl: PositionRowView['tpsl'] = {},
): PositionRowView {
  const snapshot = position(overrides)
  const { isHip3, dexTag, displaySymbol } = parseHip3Symbol(snapshot.symbol)
  return { position: snapshot, displaySymbol, dexTag, isHip3, tpsl }
}

// hasTrader / hasPositionProtection false keeps the row free of the venue-gated
// action buttons, so these tests exercise only the new symbol-select affordance.
const baseProps = {
  isLoading: false,
  onClosePosition: () => {},
  onManagePosition: () => {},
  onEditTpsl: () => {},
  onSharePosition: () => {},
  canShare: true,
  hasTrader: false,
  hasPositionProtection: false,
  showActionsColumn: true,
}

describe('PositionsPanel — select a position market', () => {
  it('calls onSelectPosition with the position symbol when the row is clicked', async () => {
    const user = userEvent.setup()
    const onSelectPosition = vi.fn()
    render(
      <PositionsPanel
        {...baseProps}
        positionRows={[row({ symbol: 'SOL-PERP' })]}
        onSelectPosition={onSelectPosition}
      />,
    )

    await user.click(screen.getByRole('button', { name: /show SOL-PERP chart/i }))

    expect(onSelectPosition).toHaveBeenCalledTimes(1)
    expect(onSelectPosition).toHaveBeenCalledWith('SOL-PERP')
  })

  it('does not select the market when a row action button is clicked', async () => {
    const user = userEvent.setup()
    const onSelectPosition = vi.fn()
    const onEditTpsl = vi.fn()
    render(
      <PositionsPanel
        {...baseProps}
        positionRows={[row({ symbol: 'SOL-PERP' })]}
        onSelectPosition={onSelectPosition}
        onEditTpsl={onEditTpsl}
        hasPositionProtection
      />,
    )

    await user.click(screen.getByRole('button', { name: /edit take profit and stop loss/i }))

    expect(onEditTpsl).toHaveBeenCalledTimes(1)
    expect(onSelectPosition).not.toHaveBeenCalled()
  })

  it('renders the symbol as static text (no chart button) when onSelectPosition is omitted', () => {
    const { container } = render(
      <PositionsPanel {...baseProps} positionRows={[row({ symbol: 'SOL-PERP' })]} />,
    )

    expect(
      screen.queryByRole('button', { name: /show SOL-PERP chart/i }),
    ).not.toBeInTheDocument()
    expect(container.textContent).toContain('SOL-PERP')
  })
})

describe('PositionsPanel — loading state (ADR-0036)', () => {
  it('renders the loading skeleton, not the empty message, while loading', () => {
    render(<PositionsPanel {...baseProps} isLoading positionRows={[]} />)
    expect(screen.getByRole('status', { name: /loading positions/i })).toBeInTheDocument()
    expect(screen.queryByText(/no open positions/i)).not.toBeInTheDocument()
  })

  it('renders the empty message once loaded with zero rows', () => {
    render(<PositionsPanel {...baseProps} isLoading={false} positionRows={[]} />)
    expect(screen.getByText(/no open positions/i)).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: /loading positions/i })).not.toBeInTheDocument()
  })
})

describe('PositionsPanel — TP/SL read-back (ADR-0051)', () => {
  it('renders the real take-profit and stop-loss prices when both rest on the position', () => {
    render(
      <PositionsPanel
        {...baseProps}
        hasPositionProtection
        positionRows={[row({ symbol: 'BTC' }, { tpPrice: 70_000, slPrice: 55_000 })]}
      />,
    )
    expect(screen.getByText('70,000 / 55,000')).toBeInTheDocument()
  })

  it('renders -- per side when only the take-profit leg rests', () => {
    render(
      <PositionsPanel
        {...baseProps}
        hasPositionProtection
        positionRows={[row({ symbol: 'BTC' }, { tpPrice: 70_000 })]}
      />,
    )
    expect(screen.getByText('70,000 / --')).toBeInTheDocument()
  })

  it('renders -- / -- when neither leg rests on the position', () => {
    render(
      <PositionsPanel
        {...baseProps}
        hasPositionProtection
        positionRows={[row({ symbol: 'BTC' }, {})]}
      />,
    )
    expect(screen.getByText('-- / --')).toBeInTheDocument()
  })

  it('keeps the edit affordance', () => {
    render(
      <PositionsPanel
        {...baseProps}
        hasPositionProtection
        positionRows={[row({ symbol: 'BTC' }, { tpPrice: 70_000, slPrice: 55_000 })]}
      />,
    )
    expect(
      screen.getByRole('button', { name: /edit take profit and stop loss/i }),
    ).toBeInTheDocument()
  })
})

describe('PositionsPanel — single-line FitCell wrapper (Issue 1)', () => {
  it('renders a long PNL value inside a single-line FitCell container', () => {
    render(
      <PositionsPanel
        {...baseProps}
        positionRows={[row({ symbol: 'BTC', unrealizedPnlUsd: 1_286.61, roePct: 78.92 })]}
      />,
    )

    // The PNL text and its compressing wrapper render as one FitCell inner span,
    // identified by FitCell's `data-fit-align` contract — guards the inline rule.
    const value = screen.getByText(/\+\$1,286\.61/)
    expect(value.closest('[data-fit-align]')).not.toBeNull()
  })

  it('renders a long TP/SL value inside a single-line FitCell container', () => {
    render(
      <PositionsPanel
        {...baseProps}
        hasPositionProtection
        positionRows={[row({ symbol: 'BTC' }, { tpPrice: 72_099, slPrice: 66_348 })]}
      />,
    )

    const value = screen.getByText('72,099 / 66,348')
    expect(value.closest('[data-fit-align]')).not.toBeNull()
  })
})

describe('PositionsPanel — Size cell drops the redundant ticker (Issue #253 follow-up)', () => {
  it('shows only the amount, keeping the full "amount ticker" in the title', () => {
    render(
      <PositionsPanel {...baseProps} positionRows={[row({ size: 89.175, symbol: 'XYZ100' })]} />,
    )

    // Visible text is the bare amount — the Asset column already names the ticker.
    const sizeCell = screen.getByTitle('89.175 XYZ100')
    expect(sizeCell).toHaveTextContent('89.175')
    // The ticker is no longer repeated as visible text in the Size cell.
    expect(screen.queryByText('89.175 XYZ100')).toBeNull()
  })
})

describe('PositionsPanel — Position Value renders as USD (Issue #253)', () => {
  it('formats the position value as a $-prefixed USD figure, not a " USDC" token amount', () => {
    render(
      <PositionsPanel {...baseProps} positionRows={[row({ positionValueUsd: 244_000 })]} />,
    )

    // `$244,000.00` — matches the Margin column and TP/SL dialog; the old
    // `244,000 USDC` suffix overflowed FitCell's 0.5 floor and clipped to "US".
    expect(screen.getByText('$244,000.00')).toBeInTheDocument()
    expect(screen.queryByText(/244,000 USDC/)).toBeNull()
  })
})

describe('PositionsPanel — Actions column hidden while spectating', () => {
  it('drops the Actions header when showActionsColumn is false', () => {
    render(
      <PositionsPanel {...baseProps} showActionsColumn={false} positionRows={[row({ symbol: 'BTC' })]} />,
    )

    expect(screen.queryByText('Actions')).toBeNull()
  })

  it('renders the Actions header when showActionsColumn is true', () => {
    render(
      <PositionsPanel {...baseProps} showActionsColumn positionRows={[row({ symbol: 'BTC' })]} />,
    )

    expect(screen.getByText('Actions')).toBeInTheDocument()
  })

  it('renders no Close/Manage buttons when the column is hidden, even with a trader', () => {
    // The cell is dropped on `showActionsColumn`, independent of `hasTrader` — so
    // a hidden column never leaves a stray Close/Manage button behind.
    render(
      <PositionsPanel
        {...baseProps}
        showActionsColumn={false}
        hasTrader
        positionRows={[row({ symbol: 'BTC' })]}
      />,
    )

    expect(screen.queryByRole('button', { name: /close position/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /manage position/i })).toBeNull()
  })
})

describe('PositionsPanel — header labels compress via FitCell (Defect 1)', () => {
  it('renders the "Position Value" header inside a FitCell wrapper', () => {
    render(<PositionsPanel {...baseProps} positionRows={[]} />)

    // The header text lives inside FitCell's inner span (identified by the
    // `data-fit-align` contract) so it scaleX-compresses instead of clipping to
    // "POSITION VALU".
    const header = screen.getByText('Position Value')
    expect(header.closest('[data-fit-align]')).not.toBeNull()
  })
})

describe('PositionsPanel — HIP-3 dex badge', () => {
  it('renders the clean asset name and a dex badge for a HIP-3 position', () => {
    const { container } = render(
      <PositionsPanel {...baseProps} positionRows={[row({ symbol: 'xyz:NVDA' })]} />,
    )

    // The clean asset name shows, the raw namespaced symbol does not.
    expect(screen.getByText('NVDA')).toBeInTheDocument()
    expect(container.textContent).not.toContain('xyz:NVDA')
    // The builder-dex tag renders as its own badge element.
    expect(screen.getByText('XYZ')).toBeInTheDocument()
  })

  it('renders the bare symbol with no dex badge for a main-dex position', () => {
    render(<PositionsPanel {...baseProps} positionRows={[row({ symbol: 'BTC' })]} />)

    expect(screen.getByText('BTC')).toBeInTheDocument()
    // No HIP-3 tag is produced for a bare main-dex coin (parseHip3Symbol → dexTag '').
    expect(screen.queryByText('XYZ')).not.toBeInTheDocument()
  })
})
