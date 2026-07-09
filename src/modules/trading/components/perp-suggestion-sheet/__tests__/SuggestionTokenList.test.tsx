import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SuggestionTokenList } from '../SuggestionTokenList'
import {
  DEFAULT_SUGGESTION_TOKENS,
  makeSuggestionToken,
} from '../__fixtures__/suggestions'

function renderList(
  overrides: { onSelect?: (s: string) => void; isLoading?: boolean } = {},
) {
  const onSelect = overrides.onSelect ?? vi.fn()
  render(
    <SuggestionTokenList
      label="Market"
      tokens={DEFAULT_SUGGESTION_TOKENS}
      isLoading={overrides.isLoading ?? false}
      selectedSymbol="BTC"
      onSelect={onSelect}
    />,
  )
  return { onSelect }
}

/** The dropdown is a combobox — focus the searchbar to open the results list. */
function openDropdown() {
  fireEvent.focus(screen.getByTestId('token-search'))
}

describe('SuggestionTokenList', () => {
  it('opens the dropdown on focus, rendering a row per token with its icon', () => {
    renderList()
    expect(screen.queryByTestId('token-list')).not.toBeInTheDocument()
    openDropdown()
    DEFAULT_SUGGESTION_TOKENS.forEach((token) => {
      const row = screen.getByTestId(`token-${token.symbol}`)
      // The shared AssetIcon resolves a perp market to an <img alt={baseAsset}>
      // (the icon-system reuse the slice mandates — no parallel cache).
      const icon = within(row).getByRole('img', { name: token.market.baseAsset })
      expect(icon).toBeInTheDocument()
    })
  })

  it('shows the selected market in the searchbar while closed', () => {
    renderList()
    expect(screen.getByTestId('token-search')).toHaveValue('BTC')
  })

  it('shows a loading skeleton (not the token rows or empty copy) while loading', () => {
    renderList({ isLoading: true })
    openDropdown()
    expect(screen.getByTestId('token-list-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('token-list')).not.toBeInTheDocument()
    expect(screen.queryByTestId('token-list-empty')).not.toBeInTheDocument()
  })

  it('marks the selected token row as pressed', () => {
    renderList()
    openDropdown()
    expect(screen.getByTestId('token-BTC')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('token-ETH')).toHaveAttribute('aria-pressed', 'false')
  })

  it('filters by symbol as the user types (case-insensitive)', async () => {
    const user = userEvent.setup()
    renderList()
    await user.type(screen.getByTestId('token-search'), 'eth')
    expect(screen.getByTestId('token-ETH')).toBeInTheDocument()
    expect(screen.queryByTestId('token-BTC')).not.toBeInTheDocument()
    expect(screen.queryByTestId('token-SOL')).not.toBeInTheDocument()
  })

  it('filters by base asset', async () => {
    const user = userEvent.setup()
    renderList()
    await user.type(screen.getByTestId('token-search'), 'SOL')
    expect(screen.getByTestId('token-SOL')).toBeInTheDocument()
    expect(screen.queryByTestId('token-BTC')).not.toBeInTheDocument()
  })

  it('shows the empty copy when no token matches', async () => {
    const user = userEvent.setup()
    renderList()
    await user.type(screen.getByTestId('token-search'), 'zzz')
    expect(screen.getByTestId('token-list-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('token-list')).not.toBeInTheDocument()
  })

  it('calls onSelect with the chosen symbol on row click', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderList()
    openDropdown()
    await user.click(screen.getByTestId('token-SOL'))
    expect(onSelect).toHaveBeenCalledWith('SOL')
  })

  it('closes the dropdown after a selection', async () => {
    const user = userEvent.setup()
    renderList()
    openDropdown()
    await user.click(screen.getByTestId('token-SOL'))
    expect(screen.queryByTestId('token-list')).not.toBeInTheDocument()
  })

  describe('selected-market icon (#5)', () => {
    it('shows the selected market icon in the input gutter while closed', () => {
      renderList()
      const icon = screen.getByTestId('token-selected-icon')
      // AssetIcon resolves the selected perp market to an <img alt={baseAsset}>.
      expect(within(icon).getByRole('img', { name: 'BTC' })).toBeInTheDocument()
    })

    it('hides the gutter icon once the dropdown opens', () => {
      renderList()
      expect(screen.getByTestId('token-selected-icon')).toBeInTheDocument()
      openDropdown()
      expect(screen.queryByTestId('token-selected-icon')).not.toBeInTheDocument()
    })
  })

  describe('asset-class grouping (ADR-0062)', () => {
    it('renders an ordered section header per non-empty category', () => {
      const tokens = [
        makeSuggestionToken('BTC'), // crypto
        makeSuggestionToken('AAPL'), // stocks
        makeSuggestionToken('GOLD'), // commodities
      ]
      render(
        <SuggestionTokenList
          label="Market"
          tokens={tokens}
          isLoading={false}
          selectedSymbol="BTC"
          onSelect={vi.fn()}
        />,
      )
      openDropdown()
      expect(screen.getByTestId('token-group-crypto')).toBeInTheDocument()
      expect(screen.getByTestId('token-group-stocks')).toBeInTheDocument()
      expect(screen.getByTestId('token-group-commodities')).toBeInTheDocument()
      // Section order follows MARKET_CATEGORY_TABS: crypto before stocks before commodities.
      const headers = screen.getAllByText(/crypto|stocks|commodities/i)
      const order = headers.map((h) => h.dataset.testid)
      expect(order).toEqual([
        'token-group-crypto',
        'token-group-stocks',
        'token-group-commodities',
      ])
    })

    it('drops a section whose tokens are all filtered out', async () => {
      const user = userEvent.setup()
      const tokens = [makeSuggestionToken('BTC'), makeSuggestionToken('AAPL')]
      render(
        <SuggestionTokenList
          label="Market"
          tokens={tokens}
          isLoading={false}
          selectedSymbol="BTC"
          onSelect={vi.fn()}
        />,
      )
      await user.type(screen.getByTestId('token-search'), 'AAPL')
      expect(screen.getByTestId('token-group-stocks')).toBeInTheDocument()
      expect(screen.queryByTestId('token-group-crypto')).not.toBeInTheDocument()
    })
  })
})
