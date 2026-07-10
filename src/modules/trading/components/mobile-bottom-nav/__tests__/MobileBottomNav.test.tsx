import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { MobileBottomNav } from '../MobileBottomNav'

function renderAt(
  path: string,
  handlers: { onOpenSearch?: () => void; onOpenChat?: () => void } = {},
) {
  const onOpenSearch = handlers.onOpenSearch ?? vi.fn()
  const onOpenChat = handlers.onOpenChat ?? vi.fn()
  render(
    <MemoryRouter initialEntries={[path]}>
      <MobileBottomNav onOpenSearch={onOpenSearch} onOpenChat={onOpenChat} />
    </MemoryRouter>,
  )
  return { onOpenSearch, onOpenChat }
}

describe('MobileBottomNav', () => {
  it('renders 4 cells in order: Browse, Markets, My Bets, Chat (PRD 0008 §6)', () => {
    renderAt('/')
    const cells = screen.getAllByTestId(/^mobile-nav-cell-/)
    expect(cells).toHaveLength(4)
    expect(cells.map((c) => c.getAttribute('data-testid'))).toEqual([
      'mobile-nav-cell-browse',
      'mobile-nav-cell-markets',
      'mobile-nav-cell-my-bets',
      'mobile-nav-cell-chat',
    ])
  })

  it('Browse and My Bets render as anchors (real routes)', () => {
    renderAt('/')
    const browse = screen.getByTestId('mobile-nav-cell-browse')
    const myBets = screen.getByTestId('mobile-nav-cell-my-bets')
    expect(browse.tagName.toLowerCase()).toBe('a')
    expect(myBets.tagName.toLowerCase()).toBe('a')
    expect(browse.getAttribute('href')).toBe('/')
    expect(myBets.getAttribute('href')).toBe('/my-bets')
  })

  it('Markets and Chat render as action buttons', () => {
    renderAt('/')
    for (const name of ['markets', 'chat']) {
      const cell = screen.getByTestId(`mobile-nav-cell-${name}`)
      expect(cell.tagName.toLowerCase()).toBe('button')
    }
  })

  it('Markets opens the search overlay via its handler', async () => {
    const { onOpenSearch } = renderAt('/')
    await userEvent.click(screen.getByTestId('mobile-nav-cell-markets'))
    expect(onOpenSearch).toHaveBeenCalledTimes(1)
  })

  it('Chat opens the chat sheet via its handler', async () => {
    const { onOpenChat } = renderAt('/')
    await userEvent.click(screen.getByTestId('mobile-nav-cell-chat'))
    expect(onOpenChat).toHaveBeenCalledTimes(1)
  })

  it('highlights Browse only on the exact lobby path', () => {
    renderAt('/')
    expect(screen.getByTestId('mobile-nav-cell-browse')).toHaveAttribute('data-active', 'true')
    expect(screen.getByTestId('mobile-nav-cell-my-bets')).toHaveAttribute('data-active', 'false')
  })

  it('does not highlight Browse on a non-lobby route', () => {
    renderAt('/my-bets')
    expect(screen.getByTestId('mobile-nav-cell-browse')).toHaveAttribute('data-active', 'false')
    expect(screen.getByTestId('mobile-nav-cell-my-bets')).toHaveAttribute('data-active', 'true')
  })
})
