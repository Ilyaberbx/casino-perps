import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { buildPerpMarket, buildHip3Market } from '../__fixtures__/fake-markets'
import { MarketRow } from '../MarketRow'

const noop = () => {}

const BASE_MARKET_ROW_PROPS = {
  market: buildPerpMarket({
    symbol: 'BTC-PERP',
    baseAsset: 'Bitcoin',
    marketType: 'perp' as const,
    markPrice: 50000,
    change24hPct: 0.025,
  }),
  isFavorite: false,
  isSelected: false,
  onSelect: noop,
  onToggleFavorite: noop,
}

describe('MarketRow', () => {
  describe('SEL-03: row anatomy', () => {
    it('renders the perp symbol stripped of the -PERP identity suffix (06-02-T2a)', () => {
      render(<MarketRow {...BASE_MARKET_ROW_PROPS} />)
      expect(screen.getByText('BTC')).toBeInTheDocument()
      expect(screen.queryByText('BTC-PERP')).not.toBeInTheDocument()
    })

    it('keeps the -PERP routing symbol as the onSelect payload (identity contract)', async () => {
      const onSelect = vi.fn()
      const user = userEvent.setup()
      render(<MarketRow {...BASE_MARKET_ROW_PROPS} onSelect={onSelect} />)
      await user.click(screen.getByRole('button', { name: /select btc/i }))
      expect(onSelect).toHaveBeenCalledWith('BTC-PERP')
    })

    it('renders the baseAsset name (06-02-T2a)', () => {
      render(<MarketRow {...BASE_MARKET_ROW_PROPS} />)
      expect(screen.getByText('Bitcoin')).toBeInTheDocument()
    })

    it('renders the marketType badge (06-02-T2a)', () => {
      render(<MarketRow {...BASE_MARKET_ROW_PROPS} />)
      // The symbol cell now shows the stripped "BTC"; only the "PERP" badge
      // matches /^perp$/i (the suffix is no longer rendered).
      const perpElements = screen.getAllByText(/^perp$/i)
      expect(perpElements.length).toBe(1)
    })

    it('renders the favorite star button (aria-label uses the stripped symbol)', () => {
      render(<MarketRow {...BASE_MARKET_ROW_PROPS} />)
      expect(
        screen.getByRole('button', { name: /add btc to watchlist/i }),
      ).toBeInTheDocument()
    })

    it('renders the star as active when isFavorite=true', () => {
      render(<MarketRow {...BASE_MARKET_ROW_PROPS} isFavorite={true} />)
      expect(
        screen.getByRole('button', { name: /remove btc from watchlist/i }),
      ).toBeInTheDocument()
    })

    it('always renders the 24h volume column (ADR-0016: no price/volume toggle)', () => {
      render(
        <MarketRow
          {...BASE_MARKET_ROW_PROPS}
          market={buildPerpMarket({ volume24h: 1_000_000, symbol: 'BTC-PERP', markPrice: 50000 })}
        />,
      )
      // Volume renders via formatCompactUsd: 1_000_000 → "$1.00M"
      expect(screen.getByText('$1.00M')).toBeInTheDocument()
    })

    it('renders the max-leverage tag for a perp with maxLeverage', () => {
      render(
        <MarketRow
          {...BASE_MARKET_ROW_PROPS}
          market={buildPerpMarket({ symbol: 'BTC-PERP', maxLeverage: 40 })}
        />,
      )
      expect(screen.getByText('40x')).toBeInTheDocument()
    })

    it('renders the HIP-3 display symbol stripped of the dex prefix', () => {
      render(
        <MarketRow
          {...BASE_MARKET_ROW_PROPS}
          market={buildHip3Market({ symbol: 'xyz:TSLA', baseAsset: 'Tesla' })}
        />,
      )
      // Symbol cell shows the bare asset segment; dex name is conveyed by the tag.
      expect(screen.getByText('TSLA')).toBeInTheDocument()
      expect(screen.queryByText('xyz:TSLA')).not.toBeInTheDocument()
      expect(screen.getByText('XYZ')).toBeInTheDocument()
    })

    it('renders 24h change as a percent (change24hPct × 100)', () => {
      render(
        <MarketRow
          {...BASE_MARKET_ROW_PROPS}
          market={buildPerpMarket({ symbol: 'BTC-PERP', change24hPct: 0.025 })}
        />,
      )
      // 0.025 fraction → +2.50%, not the pre-ADR-0016 "+0.03%".
      expect(screen.getByText('+2.50%')).toBeInTheDocument()
    })
  })
})
