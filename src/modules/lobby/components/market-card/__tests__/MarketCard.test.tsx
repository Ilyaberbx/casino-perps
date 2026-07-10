import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MarketCard } from '../MarketCard'

const HL_BASE = 'https://app.hyperliquid.xyz/coins'

describe('MarketCard — ticker + gradient', () => {
  it('renders the uppercased display ticker bottom-left', () => {
    render(<MarketCard symbol="btc-perp" changePct={2.4} />)
    expect(screen.getByText('BTC')).toBeInTheDocument()
  })

  it('paints the deterministic gradient as the card background', () => {
    render(<MarketCard symbol="BTC" changePct={2.4} />)
    const card = screen.getByRole('article')
    expect(card.style.background).toContain('linear-gradient(160deg')
    expect(card.style.background).toContain('radial-gradient(')
  })

  it('labels the card with the ticker', () => {
    render(<MarketCard symbol="ETH-PERP" changePct={1} />)
    expect(screen.getByRole('article')).toHaveAttribute('aria-label', 'ETH')
  })
})

describe('MarketCard — 24h change chip', () => {
  it('renders a win-toned chip for a positive change', () => {
    render(<MarketCard symbol="BTC" changePct={2.43} />)
    const chip = screen.getByText('+2.4%')
    expect(chip).toHaveAttribute('data-direction', 'up')
    expect(chip.className).toContain('changeUp')
  })

  it('renders a loss-toned chip for a negative change', () => {
    render(<MarketCard symbol="BTC" changePct={-3.1} />)
    const chip = screen.getByText('-3.1%')
    expect(chip).toHaveAttribute('data-direction', 'down')
    expect(chip.className).toContain('changeLoss')
  })
})

describe('MarketCard — token logo', () => {
  it('renders the provided logoUrl as the centered logo image', () => {
    render(<MarketCard symbol="BTC" changePct={1} logoUrl="https://cdn.example/btc.png" />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://cdn.example/btc.png')
    expect(img).toHaveAttribute('alt', 'BTC')
  })

  it('resolves a logo from the symbol via the shared plumbing when no logoUrl is given', () => {
    render(<MarketCard symbol="BTC" changePct={1} />)
    expect(screen.getByRole('img')).toHaveAttribute('src', `${HL_BASE}/BTC.svg`)
  })

  it('falls back to the first-three-letters initials once the logo fails to load', () => {
    render(<MarketCard symbol="DOGE" changePct={1} logoUrl="https://cdn.example/broken.png" />)
    const img = screen.getByRole('img')
    fireEvent.error(img)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('DOG')).toBeInTheDocument()
  })
})
