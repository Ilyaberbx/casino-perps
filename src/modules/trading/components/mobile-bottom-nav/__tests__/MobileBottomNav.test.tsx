import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SpectateProvider } from '@/modules/spectate'
import { MobileBottomNav } from '../MobileBottomNav'

function renderAt(
  path: string,
  handlers: { onAskAi?: () => void; onAccount?: () => void; onSettings?: () => void } = {},
) {
  const onAskAi = handlers.onAskAi ?? vi.fn()
  const onAccount = handlers.onAccount ?? vi.fn()
  const onSettings = handlers.onSettings ?? vi.fn()
  render(
    <MemoryRouter initialEntries={[path]}>
      <SpectateProvider>
        <MobileBottomNav onAskAi={onAskAi} onAccount={onAccount} onSettings={onSettings} />
      </SpectateProvider>
    </MemoryRouter>,
  )
  return { onAskAi, onAccount, onSettings }
}

describe('MobileBottomNav', () => {
  it('renders 5 cells in order: Trade, Portfolio, Ask AI, Account, Settings', () => {
    renderAt('/trade')
    const cells = screen.getAllByTestId(/^mobile-nav-cell-/)
    expect(cells).toHaveLength(5)
    expect(cells.map((c) => c.getAttribute('data-testid'))).toEqual([
      'mobile-nav-cell-trade',
      'mobile-nav-cell-portfolio',
      'mobile-nav-cell-ask-ai',
      'mobile-nav-cell-account',
      'mobile-nav-cell-settings',
    ])
  })

  it('Trade and Portfolio render as anchors (real routes)', () => {
    renderAt('/trade')
    const trade = screen.getByTestId('mobile-nav-cell-trade')
    const portfolio = screen.getByTestId('mobile-nav-cell-portfolio')
    expect(trade.tagName.toLowerCase()).toBe('a')
    expect(portfolio.tagName.toLowerCase()).toBe('a')
    expect(trade.getAttribute('href')).toBe('/trade')
    expect(portfolio.getAttribute('href')).toBe('/portfolio')
  })

  it('Ask AI, Account and Settings render as action buttons', () => {
    renderAt('/trade')
    for (const name of ['ask-ai', 'account', 'settings']) {
      const cell = screen.getByTestId(`mobile-nav-cell-${name}`)
      expect(cell.tagName.toLowerCase()).toBe('button')
    }
  })

  it('Ask AI opens the suggestion sheet via its handler', async () => {
    const { onAskAi } = renderAt('/trade')
    await userEvent.click(screen.getByTestId('mobile-nav-cell-ask-ai'))
    expect(onAskAi).toHaveBeenCalledTimes(1)
  })

  it('Account opens the account flow via its handler', async () => {
    const { onAccount } = renderAt('/trade')
    await userEvent.click(screen.getByTestId('mobile-nav-cell-account'))
    expect(onAccount).toHaveBeenCalledTimes(1)
  })

  it('Settings opens the settings modal via its handler', async () => {
    const { onSettings } = renderAt('/trade')
    await userEvent.click(screen.getByTestId('mobile-nav-cell-settings'))
    expect(onSettings).toHaveBeenCalledTimes(1)
  })

  it('highlights the active cell based on current route', () => {
    renderAt('/trade')
    expect(screen.getByTestId('mobile-nav-cell-trade')).toHaveAttribute('data-active', 'true')
    expect(screen.getByTestId('mobile-nav-cell-portfolio')).toHaveAttribute('data-active', 'false')
  })

  it('highlights Portfolio when on /portfolio', () => {
    renderAt('/portfolio')
    expect(screen.getByTestId('mobile-nav-cell-portfolio')).toHaveAttribute('data-active', 'true')
    expect(screen.getByTestId('mobile-nav-cell-trade')).toHaveAttribute('data-active', 'false')
  })

  it('preserves the spectate param on Trade and Portfolio links while spectating', () => {
    const address = '0x1111111111111111111111111111111111111111'
    renderAt(`/trade?spectate=${address}`)
    const trade = screen.getByTestId('mobile-nav-cell-trade')
    const portfolio = screen.getByTestId('mobile-nav-cell-portfolio')
    expect(trade.getAttribute('href')).toBe(`/trade?spectate=${address}`)
    expect(portfolio.getAttribute('href')).toBe(`/portfolio?spectate=${address}`)
  })

  it('keeps links clean when not spectating', () => {
    renderAt('/trade')
    expect(screen.getByTestId('mobile-nav-cell-trade').getAttribute('href')).toBe('/trade')
    expect(screen.getByTestId('mobile-nav-cell-portfolio').getAttribute('href')).toBe('/portfolio')
  })
})
