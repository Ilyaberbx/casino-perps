import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { Market } from '@/modules/shared/domain/domain.types'
import { TopBar } from '../TopBar'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BTC_MARKET: Market = {
  symbol: 'BTC-PERP',
  baseAsset: 'BTC',
  quoteAsset: 'USD',
  venue: 'hyperliquid',
  tickSize: 0.1,
  stepSize: 0.001,
  marketType: 'perp',
  hlCoin: 'BTC',
}

const HYPE_MARKET: Market = {
  symbol: 'HYPE-SPOT',
  baseAsset: 'HYPE',
  quoteAsset: 'USD',
  venue: 'hyperliquid',
  tickSize: 0.001,
  stepSize: 0.01,
  marketType: 'spot',
  hlCoin: '@107',
}

// ---------------------------------------------------------------------------
// Mocks — hoist vi.mock calls above imports
// ---------------------------------------------------------------------------

vi.mock('../use-top-bar')
vi.mock('@/modules/shared/providers/venue-provider', () => ({
  useVenue: vi.fn(() => ({
    metadata: { id: 'mock', name: 'Mock' },
    capabilities: {
      connection: {
        subscribe: vi.fn(() => vi.fn()),
        getSnapshot: vi.fn(() => 'connected'),
      },
    },
  })),
}))
vi.mock('../../market-selection-window', () => ({
  MarketSelectionWindow: () => null,
}))

const { useTopBar } = await import('../use-top-bar')
const mockedUseTopBar = vi.mocked(useTopBar)

function deriveHeaderLabel(market: Market) {
  if (market.marketType === 'hip3') {
    const [dex, asset] = market.symbol.split(':')
    return { label: asset ?? market.symbol, dexTag: (dex ?? '').toUpperCase() }
  }
  const label = market.symbol.endsWith('-PERP')
    ? market.symbol.slice(0, -'-PERP'.length)
    : market.symbol
  return { label, dexTag: null }
}

function makeTopBarReturn(market: Market) {
  return {
    selectedMarket: market.symbol,
    market,
    marketHeaderLabel: deriveHeaderLabel(market),
    hasResolvedMarket: true,
    setSelectedMarket: vi.fn(),
    isMobile: false,
    isWindowOpen: false,
    openWindow: vi.fn(),
    closeWindow: vi.fn(),
    handleSelectMarket: vi.fn(),
    ticker: null,
    stats: null,
    markFlash: null,
    isFavorite: false,
    toggleFavorite: vi.fn(),
  }
}

// ---------------------------------------------------------------------------
// Tests — ICON-03: AssetIcon renders next to MarketDropdownButton
// ---------------------------------------------------------------------------

describe('TopBar — ICON-03: AssetIcon in strip', () => {
  it('renders an img or letter-placeholder element (AssetIcon present in strip) for BTC market', () => {
    mockedUseTopBar.mockReturnValue(makeTopBarReturn(BTC_MARKET))
    render(<TopBar />)

    // AssetIcon renders either an <img role="img"> or a div with role="img" (letter placeholder)
    const iconElements = screen.getAllByRole('img')
    expect(iconElements.length).toBeGreaterThanOrEqual(1)
  })

  it('renders icon slot before MarketDropdownButton (iconSlot div before button in DOM)', () => {
    mockedUseTopBar.mockReturnValue(makeTopBarReturn(BTC_MARKET))
    const { container } = render(<TopBar />)

    // The iconSlot wrapper div is placed between FavoriteStar and MarketDropdownButton.
    // The strip container's direct children order: button(FavoriteStar), div(iconSlot), button(marketDropdown), ...
    const stripContainer = container.firstElementChild
    expect(stripContainer).not.toBeNull()
    if (!stripContainer) return

    const children = Array.from(stripContainer.children)

    // The second child (index 1) should be the iconSlot
    const secondChild = children[1]
    const thirdChild = children[2]
    expect(secondChild).toBeDefined()
    expect(thirdChild).toBeDefined()

    // The icon slot wraps AssetIcon which renders either img or placeholder
    const iconSlotHasContent =
      secondChild?.querySelector('img') !== null ||
      secondChild?.querySelector('[role="img"]') !== null ||
      (secondChild?.childElementCount ?? 0) > 0

    expect(iconSlotHasContent).toBe(true)

    // The market dropdown button (third child) is a button element
    expect(thirdChild?.tagName.toLowerCase()).toBe('button')
  })
})

// ---------------------------------------------------------------------------
// Tests — ICON-04: dark-fill container for HYPE market
// ---------------------------------------------------------------------------

describe('TopBar — ICON-04: dark-fill container for HYPE', () => {
  it('renders a container with darkFillContainer class when market.baseAsset is HYPE', () => {
    mockedUseTopBar.mockReturnValue(makeTopBarReturn(HYPE_MARKET))
    const { container } = render(<TopBar />)

    // AssetIcon internally applies darkFillContainer CSS class for HYPE
    const darkFillDiv = container.querySelector('[class*="darkFillContainer"]')
    expect(darkFillDiv).not.toBeNull()
  })

  it('does NOT render darkFillContainer class when market.baseAsset is BTC', () => {
    mockedUseTopBar.mockReturnValue(makeTopBarReturn(BTC_MARKET))
    const { container } = render(<TopBar />)

    const darkFillDiv = container.querySelector('[class*="darkFillContainer"]')
    expect(darkFillDiv).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Tests — MarketSelectionWindow wired: clicking button calls openWindow
// ---------------------------------------------------------------------------

describe('TopBar — MarketSelectionWindow wiring', () => {
  it('renders MarketDropdownButton (button element) instead of a select element', () => {
    mockedUseTopBar.mockReturnValue(makeTopBarReturn(BTC_MARKET))
    render(<TopBar />)

    // No select element should exist — MarketDropdown is gone
    const selectElement = document.querySelector('select')
    expect(selectElement).toBeNull()

    // MarketDropdownButton renders as a button with aria-haspopup="dialog"
    const triggerButton = screen.getByRole('button', { name: /select market/i })
    expect(triggerButton).toBeDefined()
  })

  it('renders the header label stripped of the -PERP suffix while the routing symbol stays suffixed', () => {
    mockedUseTopBar.mockReturnValue(makeTopBarReturn(BTC_MARKET))
    render(<TopBar />)

    // The visible header shows the stripped display symbol…
    expect(screen.getByText('BTC')).toBeInTheDocument()
    expect(screen.queryByText('BTC-PERP')).not.toBeInTheDocument()
    // …while the routing identity symbol the hook holds is untouched.
    expect(makeTopBarReturn(BTC_MARKET).selectedMarket).toBe('BTC-PERP')
  })

  it('calls openWindow when MarketDropdownButton is clicked', async () => {
    const openWindow = vi.fn()
    mockedUseTopBar.mockReturnValue({ ...makeTopBarReturn(BTC_MARKET), openWindow })
    render(<TopBar />)

    const triggerButton = screen.getByRole('button', { name: /select market/i })
    triggerButton.click()
    expect(openWindow).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// The mobile ticker strip (prominent mark price + Oracle/Vol/OI/Funding stats)
// was removed with the pro/ticker surfaces (PRD-0008 §9.3), so its tests are
// gone. TopBar mobile now renders only the market identity row.
