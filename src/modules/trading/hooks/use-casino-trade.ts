import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth, useIsWalletConnected } from '@/modules/account'
import { useCapability, useOwnCapability } from '@/modules/shared/providers/venue-provider'
import { useManageFunds } from '@/modules/shared/providers/manage-funds-provider'
import { useSelectedMarketContext } from '../providers/selected-market-provider'
import { useLeverageMargin } from '../providers/leverage-margin'
import { useLiveMark } from '../components/order-entry/use-live-mark'
import { CASINO_BET_PRESETS } from './casino-trade.constants'
import {
  buildBetDraft,
  formatLiquidationSentence,
  marginToSize,
  resolveConfirmCta,
  sizeLotDecimals,
} from './casino-trade.utils'
import { usePlaceBet } from './use-place-bet'
import { useLiveBet, type UseLiveBetReturn } from './use-live-bet'
import type { BetDirection, PendingBet } from './casino-trade.types'

const USD_DECIMALS = 2

export interface UseCasinoTradeReturn {
  readonly ticker: string
  readonly markPrice: number
  readonly change24hPct: number | null
  readonly betPresets: ReadonlyArray<number>
  readonly betAmount: number
  readonly leverage: number
  readonly maxLeverage: number
  readonly canBet: boolean
  readonly pendingBet: PendingBet | null
  readonly liveBet: UseLiveBetReturn['liveBet']
  readonly isCashingOut: boolean
  selectAmount(amount: number): void
  selectMax(): void
  setMultiplier(leverage: number): void
  openConfirm(direction: BetDirection): void
  closeConfirm(): void
  confirmPrimary(): void
  cashOut(): void
}

/**
 * The Casino-Mode trade screen brain (PRD §8, D16/D17/D18). Owns the bet amount
 * (margin), the multiplier (via the shared leverage provider), the confirm-sheet
 * direction/state, and the D18 margin→size conversion. Placement + the silent
 * agent setup live in `usePlaceBet`; the open bet + Cash Out in `useLiveBet`.
 */
export function useCasinoTrade(): UseCasinoTradeReturn {
  const { selectedMarket, market } = useSelectedMarketContext()
  const { leverage, maxLeverage, applyLeverage } = useLeverageMargin()
  const markPrice = useLiveMark(selectedMarket, market.markPrice ?? 0)
  const trader = useCapability('trader')
  const portfolioCap = useOwnCapability('portfolio')
  const isConnected = useIsWalletConnected()
  const { openConnectModal } = useAuth()
  const manageFunds = useManageFunds()
  const placeBet = usePlaceBet()
  const liveBet = useLiveBet(market)

  const [availableMargin, setAvailableMargin] = useState(0)
  const [betAmount, setBetAmount] = useState<number>(CASINO_BET_PRESETS[0])
  const [confirmDirection, setConfirmDirection] = useState<BetDirection | null>(null)

  // KNOWN LIMITATION: `accountValue` is total equity, not free margin. With an
  // open bet, part of it is already posted as collateral, so MAX can propose a
  // stake the venue will reject for insufficient margin. Correct fix is a
  // withdrawable/free-margin field off the balances reader. Left as-is for the
  // prototype; the venue rejects rather than mis-fills, so it fails safe.
  useEffect(() => {
    if (!portfolioCap) return
    return portfolioCap.subscribeSnapshot('perps', (snapshot) => {
      setAvailableMargin(snapshot.accountValue)
    })
  }, [portfolioCap])

  const szDecimals = sizeLotDecimals(market)
  const size = useMemo(
    () => marginToSize(betAmount, leverage, markPrice, szDecimals),
    [betAmount, leverage, markPrice, szDecimals],
  )
  const hasBalance = availableMargin > 0
  const canBet = size > 0

  const selectAmount = useCallback((amount: number) => setBetAmount(amount), [])
  const selectMax = useCallback(() => {
    const factor = 10 ** USD_DECIMALS
    setBetAmount(Math.floor(availableMargin * factor) / factor)
  }, [availableMargin])

  const setMultiplier = useCallback((next: number) => applyLeverage(next), [applyLeverage])

  const openConfirm = useCallback((direction: BetDirection) => setConfirmDirection(direction), [])
  const closeConfirm = useCallback(() => setConfirmDirection(null), [])

  const pendingBet = useMemo<PendingBet | null>(() => {
    if (confirmDirection === null) return null
    const draft = buildBetDraft({ symbol: selectedMarket, direction: confirmDirection, size, leverage })
    const estimates = trader.previewOrder(draft).estimates
    const liquidationPrice = estimates.kind === 'linear' ? estimates.liquidationPrice : 0
    return {
      direction: confirmDirection,
      betAmount,
      leverage,
      ticker: market.baseAsset,
      liquidationSentence: formatLiquidationSentence(confirmDirection, liquidationPrice, market),
      cta: resolveConfirmCta({
        isConnected,
        hasBalance,
        isSettingUp: placeBet.isSettingUp,
        isPlacing: placeBet.isPlacing,
      }),
      draft,
    }
  }, [
    confirmDirection,
    selectedMarket,
    size,
    leverage,
    betAmount,
    market,
    trader,
    isConnected,
    hasBalance,
    placeBet.isSettingUp,
    placeBet.isPlacing,
  ])

  const confirmPrimary = useCallback(() => {
    if (pendingBet === null) return
    if (pendingBet.cta === 'connect') {
      openConnectModal()
      return
    }
    if (pendingBet.cta === 'add-cash') {
      manageFunds.open('deposit')
      return
    }
    if (pendingBet.cta !== 'place-bet') return
    const label = `$${pendingBet.betAmount} on ${pendingBet.ticker} ${pendingBet.direction.toUpperCase()}`
    placeBet.place({ draft: pendingBet.draft, label, onPlaced: closeConfirm })
  }, [pendingBet, openConnectModal, manageFunds, placeBet, closeConfirm])

  return {
    ticker: market.baseAsset,
    markPrice,
    change24hPct: market.change24hPct ?? null,
    betPresets: CASINO_BET_PRESETS,
    betAmount,
    leverage,
    maxLeverage,
    canBet,
    pendingBet,
    liveBet: liveBet.liveBet,
    isCashingOut: liveBet.isCashingOut,
    selectAmount,
    selectMax,
    setMultiplier,
    openConfirm,
    closeConfirm,
    confirmPrimary,
    cashOut: liveBet.cashOut,
  }
}
