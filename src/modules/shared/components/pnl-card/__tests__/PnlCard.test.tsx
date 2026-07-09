import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PnlCard } from '../PnlCard'
import { DEFAULT_ART_SELECTION } from '../pnl-card.constants'
import { fromClosedFill, fromPositionSnapshot } from '../pnl-card.utils'
import { fakeClosedFill, fakePositionSnapshot } from '../__fixtures__/pnl-card-fixtures'
import type { PnlCardView, PnlHeroDisplay } from '../pnl-card.types'

function renderCard(
  view: PnlCardView,
  displayMode: PnlHeroDisplay,
  iconDataUrl: string | null = null,
) {
  return render(
    <PnlCard
      view={view}
      displayMode={displayMode}
      selection={DEFAULT_ART_SELECTION}
      iconDataUrl={iconDataUrl}
      isIconResolving={false}
    />,
  )
}

describe('PnlCard', () => {
  it('renders the % hero and PROFIT label for a winning full position', () => {
    renderCard(fromPositionSnapshot(fakePositionSnapshot()), 'pct')
    expect(screen.getByText('PROFIT')).toBeInTheDocument()
    expect(screen.getByText('+31.63%')).toBeInTheDocument()
    // The $ figure shows as the sub-line beneath the % hero.
    expect(screen.getByText('+$3,835.00')).toBeInTheDocument()
    expect(screen.getByText('ENTRY')).toBeInTheDocument()
  })

  it('renders the LOSS label for a losing position', () => {
    const view = fromPositionSnapshot(
      fakePositionSnapshot({ side: 'short', unrealizedPnlUsd: -120, roePct: -8.4 }),
    )
    renderCard(view, 'pct')
    expect(screen.getByText('LOSS')).toBeInTheDocument()
    expect(screen.queryByText('PROFIT')).not.toBeInTheDocument()
    expect(screen.getByText('-8.40%')).toBeInTheDocument()
  })

  it('renders the derived ENTRY column and % sub-line for a degraded fill', () => {
    renderCard(fromClosedFill(fakeClosedFill()), 'usd')
    // Hero $ figure with the derived realized-% as the sub-line.
    expect(screen.getByText('+$412.80')).toBeInTheDocument()
    expect(screen.getByText('+7.08%')).toBeInTheDocument()
    // Entry is reconstructed from the fill arithmetic; exit keeps its label.
    expect(screen.getByText('ENTRY')).toBeInTheDocument()
    expect(screen.getByText('EXIT')).toBeInTheDocument()
  })

  it('drops ENTRY and the % sub-line when the fill carries no closedPnl', () => {
    renderCard(fromClosedFill(fakeClosedFill({ closedPnl: undefined })), 'usd')
    expect(screen.getAllByText('+$0.00')).toHaveLength(1)
    expect(screen.queryByText('ENTRY')).not.toBeInTheDocument()
    expect(screen.getByText('EXIT')).toBeInTheDocument()
  })

  it('renders the inlined market icon when a data URL is supplied', () => {
    const { container } = renderCard(
      fromPositionSnapshot(fakePositionSnapshot()),
      'pct',
      'data:image/png;base64,AAAA',
    )
    // Decorative (alt=""), so it's role="presentation" — query the DOM directly.
    const icon = container.querySelector('img')
    expect(icon).not.toBeNull()
    expect(icon).toHaveAttribute('src', 'data:image/png;base64,AAAA')
  })
})
