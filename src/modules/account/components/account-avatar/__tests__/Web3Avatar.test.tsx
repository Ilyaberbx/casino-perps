import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Web3Avatar } from '../Web3Avatar'

describe('<Web3Avatar />', () => {
  it('renders the web3-avatar fallback seeded from the address when iconUrl is null', () => {
    render(<Web3Avatar iconUrl={null} address="0xAbC0000000000000000000000000000000000001" size={40} />)
    const fallback = screen.getByTestId('web3-avatar')
    expect(fallback).toBeInTheDocument()
    // The seed is the lower-cased Native Wallet address.
    expect(fallback).toHaveAttribute('data-avatar-seed', '0xabc0000000000000000000000000000000000001')
  })

  it('renders the iconUrl image when one is set, not the web3-avatar fallback', () => {
    render(
      <Web3Avatar
        iconUrl="https://example.com/icon.png"
        address="0xabc0000000000000000000000000000000000001"
        size={40}
      />,
    )
    expect(screen.getByRole('img', { name: /avatar/i })).toHaveAttribute(
      'src',
      'https://example.com/icon.png',
    )
    expect(screen.queryByTestId('web3-avatar')).not.toBeInTheDocument()
  })
})
