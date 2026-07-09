import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TickerStats } from '../TickerStats'
import type { MarketStripStats } from '../top-bar.types'

const PERP_STATS: MarketStripStats = {
  marketType: 'perp',
  markPriceText: '50,000.00',
  oraclePriceText: '49,990.00',
  change24hText: '+1.23%',
  change24hDirection: 'up',
  volume24hText: '$1.50B',
  openInterestText: '$2.50M',
  fundingRateText: '+0.0100%',
  fundingRateDirection: 'up',
  fundingCountdownText: '04:23',
}

const HIP3_STATS: MarketStripStats = {
  marketType: 'hip3',
  markPriceText: '250.00',
  oraclePriceText: '249.50',
  change24hText: '-0.50%',
  change24hDirection: 'down',
  volume24hText: '$3.00M',
}

const SPOT_STATS: MarketStripStats = {
  marketType: 'spot',
  markPriceText: '12.34',
  change24hText: '+0.10%',
  change24hDirection: 'up',
  volume24hText: '$5.00M',
}

describe('TickerStats — per-marketType cell set (omit, not dash)', () => {
  it('renders the loading container when stats is null', () => {
    render(<TickerStats stats={null} markFlash={null} />)
    expect(screen.getByLabelText('Ticker loading')).toBeInTheDocument()
  })

  it('perp renders the full cell set', () => {
    render(<TickerStats stats={PERP_STATS} markFlash={null} />)
    expect(screen.getByText('Mark')).toBeInTheDocument()
    expect(screen.getByText('Oracle')).toBeInTheDocument()
    expect(screen.getByText('24h Change')).toBeInTheDocument()
    expect(screen.getByText('24h Volume')).toBeInTheDocument()
    expect(screen.getByText('Open Interest')).toBeInTheDocument()
    expect(screen.getByText('Funding / Countdown')).toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('hip3 omits Open Interest and Funding (keeps Oracle), never dashes', () => {
    render(<TickerStats stats={HIP3_STATS} markFlash={null} />)
    expect(screen.getByText('Mark')).toBeInTheDocument()
    expect(screen.getByText('Oracle')).toBeInTheDocument()
    expect(screen.getByText('24h Change')).toBeInTheDocument()
    expect(screen.getByText('24h Volume')).toBeInTheDocument()
    expect(screen.queryByText('Open Interest')).not.toBeInTheDocument()
    expect(screen.queryByText('Funding / Countdown')).not.toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('spot omits Oracle, Open Interest and Funding, never dashes', () => {
    render(<TickerStats stats={SPOT_STATS} markFlash={null} />)
    expect(screen.getByText('Mark')).toBeInTheDocument()
    expect(screen.getByText('24h Change')).toBeInTheDocument()
    expect(screen.getByText('24h Volume')).toBeInTheDocument()
    expect(screen.queryByText('Oracle')).not.toBeInTheDocument()
    expect(screen.queryByText('Open Interest')).not.toBeInTheDocument()
    expect(screen.queryByText('Funding / Countdown')).not.toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })
})
