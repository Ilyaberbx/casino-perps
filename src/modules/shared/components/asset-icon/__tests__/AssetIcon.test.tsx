import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { Market } from '@/modules/shared/domain/domain.types'
import { TRADINGVIEW_LOGOID_MAP } from '@/modules/shared/constants/tradingview-logoid-map.constants'
import { AssetIcon } from '../AssetIcon'

const TV_BASE = 'https://s3-symbol-logo.tradingview.com'
const HL_BASE = 'https://app.hyperliquid.xyz/coins'
const LOGOIDS: Readonly<Record<string, string>> = TRADINGVIEW_LOGOID_MAP

// BTC perp — crypto, resolves to the Hyperliquid src first (img renders).
const BTC_PERP: Market = {
  symbol: 'BTC-PERP',
  baseAsset: 'BTC',
  quoteAsset: 'USD',
  venue: 'hyperliquid',
  tickSize: 0.1,
  stepSize: 0.001,
  marketType: 'perp',
  hlCoin: 'BTC',
}

// HYPE spot — has a logoid; baseAsset in DARK_FILL_ICON_COINS.
const HYPE_SPOT: Market = {
  symbol: 'HYPE-SPOT',
  baseAsset: 'HYPE',
  quoteAsset: 'USD',
  venue: 'hyperliquid',
  tickSize: 0.001,
  stepSize: 0.01,
  marketType: 'spot',
  hlCoin: '@107',
}

// HIP-3 market with no logoid — resolves to placeholder (no img mounted).
const NOPE_HIP3: Market = {
  symbol: 'xyz:NOPE',
  baseAsset: 'NOPE',
  quoteAsset: 'USD',
  venue: 'hyperliquid',
  tickSize: 0.01,
  stepSize: 0.001,
  marketType: 'hip3',
  hlCoin: 'xyz:NOPE',
}

describe('AssetIcon — img render', () => {
  it('renders an img element with the Hyperliquid src for a crypto market', () => {
    render(<AssetIcon market={BTC_PERP} size={20} />)
    const img = screen.getByRole('img')
    expect(img.tagName).toBe('IMG')
    expect(img).toHaveAttribute('src', `${HL_BASE}/BTC.svg`)
  })

  it('img element has alt equal to market.baseAsset', () => {
    render(<AssetIcon market={BTC_PERP} size={20} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('alt', 'BTC')
  })

  it('img element has width and height attributes equal to the size prop', () => {
    render(<AssetIcon market={BTC_PERP} size={24} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('width', '24')
    expect(img).toHaveAttribute('height', '24')
  })

  it('img element does NOT have a crossorigin attribute', () => {
    render(<AssetIcon market={BTC_PERP} size={20} />)
    const img = screen.getByRole('img')
    expect(img).not.toHaveAttribute('crossorigin')
    expect(img).not.toHaveAttribute('crossOrigin')
  })

  it('img decodes off the main thread and does NOT set loading=eager', () => {
    render(<AssetIcon market={BTC_PERP} size={20} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('decoding', 'async')
    expect(img).not.toHaveAttribute('loading')
  })
})

describe('AssetIcon — container sizing', () => {
  it('container div always has inline style width and height equal to size', () => {
    const { container } = render(<AssetIcon market={BTC_PERP} size={20} />)
    const containerDiv = container.firstChild as HTMLElement
    expect(containerDiv.style.width).toBe('20px')
    expect(containerDiv.style.height).toBe('20px')
  })

  it('container div has fixed dimensions even for placeholder render (src=null)', () => {
    const { container } = render(<AssetIcon market={NOPE_HIP3} size={20} />)
    const containerDiv = container.firstChild as HTMLElement
    expect(containerDiv.style.width).toBe('20px')
    expect(containerDiv.style.height).toBe('20px')
  })
})

describe('AssetIcon — fallback to LetterPlaceholder', () => {
  it('renders LetterPlaceholder once every candidate (HL then TV) has errored', () => {
    render(<AssetIcon market={BTC_PERP} size={20} />)

    // First the Hyperliquid img (coin-correct primary for crypto).
    const hlImg = screen.getByRole('img')
    expect(hlImg.tagName).toBe('IMG')
    expect(hlImg).toHaveAttribute('src', `${HL_BASE}/BTC.svg`)
    fireEvent.error(hlImg)

    // Then the TradingView logoid fallback img.
    const tvImg = screen.getByRole('img')
    expect(tvImg.tagName).toBe('IMG')
    expect(tvImg).toHaveAttribute('src', `${TV_BASE}/${LOGOIDS.BTC}.svg`)
    fireEvent.error(tvImg)

    // Now the LetterPlaceholder (role="img" div) replaces the <img>.
    const placeholder = screen.getByRole('img')
    expect(placeholder.tagName).not.toBe('IMG')
    expect(placeholder.textContent).toBe('B')
  })

  it('renders the LetterPlaceholder directly for a HIP-3 asset with no logoid (no img mounted)', () => {
    render(<AssetIcon market={NOPE_HIP3} size={20} />)
    const placeholder = screen.getByRole('img')
    expect(placeholder.tagName).not.toBe('IMG')
    expect(placeholder.textContent).toBe('N')
  })
})

describe('AssetIcon — dark-fill container', () => {
  it('applies darkFillContainer CSS class when market.baseAsset is HYPE', () => {
    const { container } = render(<AssetIcon market={HYPE_SPOT} size={20} />)
    const containerDiv = container.firstChild as HTMLElement
    expect(containerDiv.className).toContain('darkFillContainer')
  })

  it('does NOT apply darkFillContainer class when market.baseAsset is BTC', () => {
    const { container } = render(<AssetIcon market={BTC_PERP} size={20} />)
    const containerDiv = container.firstChild as HTMLElement
    expect(containerDiv.className).not.toContain('darkFillContainer')
  })
})
