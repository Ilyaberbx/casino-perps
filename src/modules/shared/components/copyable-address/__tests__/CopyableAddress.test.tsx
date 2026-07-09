import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CopyableAddress } from '../CopyableAddress'

const ADDRESS = '0xAbCdEf0000000000000000000000000000001234'

describe('CopyableAddress', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('renders the truncated address with the full value in the title', () => {
    render(<CopyableAddress address={ADDRESS} />)

    const display = screen.getByTitle(ADDRESS)
    expect(display.textContent).toContain('…')
    expect(display.textContent).not.toEqual(ADDRESS)
  })

  it('copies the full raw address via a keyboard-reachable button', async () => {
    render(<CopyableAddress address={ADDRESS} />)

    const button = screen.getByRole('button', { name: /copy address/i })
    button.focus()
    expect(button).toHaveFocus()
    await userEvent.click(button)

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(ADDRESS)
  })

  it('renders the QR (raw address only) when a size is provided', () => {
    render(<CopyableAddress address={ADDRESS} qrSize={140} />)

    expect(screen.getByRole('img', { name: /receive address qr code/i })).toBeInTheDocument()
  })

  it('centers the pill by default', () => {
    render(<CopyableAddress address={ADDRESS} />)

    expect(screen.getByTitle(ADDRESS).closest('[data-align]')?.getAttribute('data-align')).toBe(
      'center',
    )
  })

  it('left-aligns the pill when align="start"', () => {
    render(<CopyableAddress address={ADDRESS} align="start" />)

    expect(screen.getByTitle(ADDRESS).closest('[data-align]')?.getAttribute('data-align')).toBe(
      'start',
    )
  })
})
