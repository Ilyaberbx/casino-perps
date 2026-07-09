import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Trade } from '../../../../shared/domain/domain.types'
import type { WalletAddress } from '../../../../shared/domain/wallet-address'
import type { TradeRowProps } from '../trades-tape.types'
import { TradeRow } from '../TradeRow'

const TAKER = '0x1111111111111111111111111111111111111111' as WalletAddress
const MAKER = '0x2222222222222222222222222222222222222222' as WalletAddress

function buildTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    identifier: 'trade-1',
    symbol: 'BTC-PERP',
    side: 'buy',
    price: 65000,
    size: 0.5,
    timestamp: 1_000_000,
    takerAddress: TAKER,
    makerAddress: MAKER,
    ...overrides,
  }
}

function buildProps(overrides: Partial<TradeRowProps> = {}): TradeRowProps {
  return {
    trade: buildTrade(),
    priceSpec: { szDecimals: 0, marketType: 'perp' },
    sizeAsset: 'base',
    showParticipants: true,
    hoveredAddress: null,
    onHoverAddress: vi.fn(),
    onLeaveAddress: vi.fn(),
    onSpectateAddress: vi.fn(),
    ...overrides,
  }
}

describe('TradeRow participant controls', () => {
  it('clicking the Taker spectate control calls onSpectateAddress with the taker', () => {
    const onSpectateAddress = vi.fn()
    render(<TradeRow {...buildProps({ onSpectateAddress })} />)

    fireEvent.click(screen.getByRole('button', { name: `Spectate Taker ${TAKER}` }))
    expect(onSpectateAddress).toHaveBeenCalledWith(TAKER)
  })

  it('clicking the Maker spectate control calls onSpectateAddress with the maker', () => {
    const onSpectateAddress = vi.fn()
    render(<TradeRow {...buildProps({ onSpectateAddress })} />)

    fireEvent.click(screen.getByRole('button', { name: `Spectate Maker ${MAKER}` }))
    expect(onSpectateAddress).toHaveBeenCalledWith(MAKER)
  })

  it('hovering a participant ghost button reports the address, leaving clears it', () => {
    const onHoverAddress = vi.fn()
    const onLeaveAddress = vi.fn()
    render(<TradeRow {...buildProps({ onHoverAddress, onLeaveAddress })} />)

    const takerButton = screen.getByRole('button', { name: `Spectate Taker ${TAKER}` })
    fireEvent.mouseEnter(takerButton)
    expect(onHoverAddress).toHaveBeenCalledWith(TAKER)

    fireEvent.mouseLeave(takerButton)
    expect(onLeaveAddress).toHaveBeenCalledTimes(1)
  })

  it('renders no spectate control for an absent participant', () => {
    render(<TradeRow {...buildProps({ trade: buildTrade({ makerAddress: undefined }) })} />)
    expect(screen.queryByRole('button', { name: /Spectate Maker/ })).not.toBeInTheDocument()
  })

  it('omits participant cells entirely when showParticipants is false', () => {
    render(<TradeRow {...buildProps({ showParticipants: false })} />)
    expect(screen.queryByRole('button', { name: /Spectate/ })).not.toBeInTheDocument()
  })
})
