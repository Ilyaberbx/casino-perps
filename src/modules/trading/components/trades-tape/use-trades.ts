import { useCallback, useState } from 'react'
import type { Trade, TradesUpdate } from '../../../shared/domain/domain.types'
import type { WalletAddress } from '../../../shared/domain/wallet-address'
import { useCapability } from '../../../shared/providers/venue-provider'
import { useSpectate } from '@/modules/spectate'
import { dedupeByIdentifier } from '@/modules/shared/utils/dedupe-by-identifier'
import { useAdapterStream } from '../../hooks/use-adapter-stream'
import type { TradesState, UseTradesReturn } from './trades-tape.types'

const TRADE_CAP = 100
const EMPTY_STATE: TradesState = { trades: [], isLoading: true }

function capTrades(trades: Trade[]): Trade[] {
  const isOverCap = trades.length > TRADE_CAP
  return isOverCap ? trades.slice(0, TRADE_CAP) : trades
}

function reduceTrades(previous: TradesState, update: TradesUpdate): TradesState {
  // The snapshot is the initial set and the loaded signal — flip out of loading
  // in one step, even when it is empty (a market with no recent trades). ADR-0030.
  // Hyperliquid's `trades` WS publishes both sides of a match as separate events
  // sharing one `tid`; they arrive together in the snapshot batch, so dedupe it
  // through the shared helper so the tape can't render two rows with one key.
  const isSnapshot = update.kind === 'snapshot'
  if (isSnapshot) return { trades: capTrades(dedupeByIdentifier(update.trades)), isLoading: false }

  // Same two-sided-match collision as the snapshot, but on the streaming path.
  const isDuplicate = previous.trades.some((existing) => existing.identifier === update.trade.identifier)
  if (isDuplicate) return previous

  return { trades: capTrades([update.trade, ...previous.trades]), isLoading: false }
}

export function useTrades(symbol: string): UseTradesReturn {
  const marketDataCap = useCapability('marketData')

  const subscribe = useCallback(
    (onEvent: (update: TradesUpdate) => void) => {
      // Bug A: skip subscribe when symbol unresolved. See use-orderbook.ts.
      if (symbol === '') return () => {}
      return marketDataCap.subscribeTrades(symbol, onEvent)
    },
    [marketDataCap, symbol],
  )

  const state = useAdapterStream<TradesUpdate, TradesState>({
    initial: EMPTY_STATE,
    subscribe,
    reducer: reduceTrades,
    resetOnSubscribe: true,
  })

  const { startSpectating } = useSpectate()
  const [hoveredAddress, setHoveredAddress] = useState<WalletAddress | null>(null)

  const hoverAddress = useCallback((address: WalletAddress) => {
    setHoveredAddress(address)
  }, [])

  const leaveAddress = useCallback(() => {
    setHoveredAddress(null)
  }, [])

  const spectateAddress = useCallback(
    (address: WalletAddress) => {
      startSpectating(address)
    },
    [startSpectating],
  )

  return {
    trades: state.trades,
    isLoading: state.isLoading,
    hoveredAddress,
    hoverAddress,
    leaveAddress,
    spectateAddress,
  }
}
