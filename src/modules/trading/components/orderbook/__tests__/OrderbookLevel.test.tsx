import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OrderbookLevelRow } from '../OrderbookLevel'

// The orderbook renders value text directly — no per-cell key-remount flash
// (ADR-0043 removed it; remounting up to 66 spans per L2 tick was the dominant
// FPS sink). Live feedback now comes from the gliding depth bar, driven by a 0–1
// `--depth-scale` (total / maxTotal) that CSS scaleX-transitions.

function row(props: {
  price?: number
  size?: number
  total?: number
  maxTotal?: number
  isAsk?: boolean
  avgPrice?: number
  totalBase?: number
  totalQuote?: number
  changeSeq?: number
  changeDir?: 'up' | 'down' | null
}) {
  const {
    price = 100,
    size = 10,
    total = 50,
    maxTotal = 100,
    isAsk = false,
    // Defaults chosen so no tooltip figure collides with the 100.00 / 10.000 /
    // 50.00 the row's own cells render (getByText would throw on a duplicate).
    avgPrice = 99,
    totalBase = 5,
    totalQuote = 500,
    changeSeq = 0,
    changeDir = null,
  } = props
  return (
    <OrderbookLevelRow
      price={price}
      size={size}
      total={total}
      maxTotal={maxTotal}
      isAsk={isAsk}
      priceDecimals={2}
      avgPrice={avgPrice}
      totalBase={totalBase}
      totalQuote={totalQuote}
      baseSymbol="BTC"
      quoteSymbol="USDT"
      changeSeq={changeSeq}
      changeDir={changeDir}
    />
  )
}

describe('OrderbookLevelRow', () => {
  it('renders the formatted price, size and total', () => {
    render(row({ price: 100, size: 10, total: 50 }))
    expect(screen.getByText('100.00')).toBeInTheDocument()
    expect(screen.getByText('10.000')).toBeInTheDocument()
    expect(screen.getByText('50.00')).toBeInTheDocument()
  })

  it('swaps the displayed value when a cell changes (no leftover stale node)', () => {
    const { rerender } = render(row({ size: 10 }))
    expect(screen.getByText('10.000')).toBeInTheDocument()

    rerender(row({ size: 12 }))
    expect(screen.queryByText('10.000')).not.toBeInTheDocument()
    expect(screen.getByText('12.000')).toBeInTheDocument()
  })

  it('drives the depth bar via a 0–1 --depth-scale (total / maxTotal)', () => {
    const { container } = render(row({ total: 25, maxTotal: 100 }))
    const depthBar = container.querySelector('[class*="depthBar"]')
    expect(depthBar).not.toBeNull()
    expect((depthBar as HTMLElement).style.getPropertyValue('--depth-scale')).toBe('0.25')
  })

  it('clamps the depth scale to 0 when maxTotal is 0', () => {
    const { container } = render(row({ total: 50, maxTotal: 0 }))
    const depthBar = container.querySelector('[class*="depthBar"]')
    expect((depthBar as HTMLElement).style.getPropertyValue('--depth-scale')).toBe('0')
  })

  it('renders the hover tooltip (portalled to body) with the three cumulative figures and their units', () => {
    const { container } = render(row({ avgPrice: 99, totalBase: 5, totalQuote: 500 }))
    // Tooltip mounts on hover now (portal to document.body), not at rest.
    fireEvent.mouseEnter(container.querySelector('[data-side]') as HTMLElement)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    expect(screen.getByText('Avg Price')).toBeInTheDocument()
    expect(screen.getByText('99.00')).toBeInTheDocument()
    expect(screen.getByText('Total (BTC)')).toBeInTheDocument()
    expect(screen.getByText('5.000')).toBeInTheDocument()
    expect(screen.getByText('Total (USDT)')).toBeInTheDocument()
    expect(screen.getByText('500.00')).toBeInTheDocument()
  })

  it('unmounts the tooltip when the pointer leaves the row', () => {
    const { container } = render(row({ avgPrice: 99, totalBase: 5, totalQuote: 500 }))
    const level = container.querySelector('[data-side]') as HTMLElement
    fireEvent.mouseEnter(level)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.mouseLeave(level)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('wires the row to its tooltip via aria-describedby', () => {
    const { container } = render(row({ price: 100, isAsk: false }))
    const level = container.querySelector('[data-side="bid"]') as HTMLElement
    fireEvent.mouseEnter(level)
    const describedBy = level.getAttribute('aria-describedby')
    expect(describedBy).toBe('orderbook-tt-bid-100')
    expect(screen.getByRole('tooltip').id).toBe(describedBy)
  })

  it('renders no flash overlay for an unchanged level (changeDir null)', () => {
    const { container } = render(row({ changeDir: null, changeSeq: 0 }))
    expect(container.querySelector('[class*="flash"]')).toBeNull()
  })

  it('flashes with a side-specific colour: bids green, asks red (independent of change direction)', () => {
    // A buy (bid) level always flashes green (flashUp) whether its size rose or fell.
    const bidUp = render(row({ isAsk: false, changeDir: 'up', changeSeq: 1 }))
    expect(bidUp.container.querySelector('[class*="flashUp"]')).not.toBeNull()
    expect(bidUp.container.querySelector('[class*="flashDown"]')).toBeNull()

    const bidDown = render(row({ isAsk: false, changeDir: 'down', changeSeq: 1 }))
    expect(bidDown.container.querySelector('[class*="flashUp"]')).not.toBeNull()
    expect(bidDown.container.querySelector('[class*="flashDown"]')).toBeNull()

    // A sell (ask) level always flashes red (flashDown) in either direction.
    const askDown = render(row({ isAsk: true, changeDir: 'down', changeSeq: 1 }))
    expect(askDown.container.querySelector('[class*="flashDown"]')).not.toBeNull()
    expect(askDown.container.querySelector('[class*="flashUp"]')).toBeNull()

    const askUp = render(row({ isAsk: true, changeDir: 'up', changeSeq: 1 }))
    expect(askUp.container.querySelector('[class*="flashDown"]')).not.toBeNull()
    expect(askUp.container.querySelector('[class*="flashUp"]')).toBeNull()
  })
})
