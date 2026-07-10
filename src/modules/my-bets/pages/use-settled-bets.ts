import { useEffect, useState } from 'react'
import { useCapabilityOptional } from '@/modules/shared/providers/venue-provider'
import { mergeSettledBet } from '../my-bets.utils'
import type { SettledBet } from '../my-bets.types'

/**
 * The SETTLED history: closed bets that booked realised profit/loss, newest
 * first. Backed by the venue's `FillsReader` — each close fill with a
 * `closedPnl` is one settled bet. Degrades to an empty list when the venue
 * exposes no fills stream.
 */
export function useSettledBets(): ReadonlyArray<SettledBet> {
  const fills = useCapabilityOptional('fills')
  const [settledBets, setSettledBets] = useState<ReadonlyArray<SettledBet>>([])

  useEffect(() => {
    if (!fills) return
    return fills.subscribe((fill) => {
      setSettledBets((previous) => mergeSettledBet(previous, fill))
    })
  }, [fills])

  return settledBets
}
