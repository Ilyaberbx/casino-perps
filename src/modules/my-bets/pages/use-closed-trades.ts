import { useEffect, useState } from 'react'
import { useCapabilityOptional } from '@/modules/shared/providers/venue-provider'
import { mergeClosedTrade } from '../my-bets.utils'
import type { ClosedTradeRow } from '../my-bets.types'

/**
 * Trade history: closed positions that booked realised PnL, newest first. Backed
 * by the venue's `FillsReader` — each close fill with a `closedPnl` is one
 * closed trade. Degrades to an empty list when the venue exposes no fills stream.
 */
export function useClosedTrades(): ReadonlyArray<ClosedTradeRow> {
  const fills = useCapabilityOptional('fills')
  const [closedTrades, setClosedTrades] = useState<ReadonlyArray<ClosedTradeRow>>([])

  useEffect(() => {
    if (!fills) return
    return fills.subscribe((fill) => {
      setClosedTrades((previous) => mergeClosedTrade(previous, fill))
    })
  }, [fills])

  return closedTrades
}
