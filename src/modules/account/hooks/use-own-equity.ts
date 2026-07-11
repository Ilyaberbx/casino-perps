import { useEffect, useState } from 'react'
import { useOwnCapability } from '@/modules/shared/providers/venue-provider'
import { useIsWalletConnected } from '../components/use-is-wallet-connected'

export interface OwnEquityView {
  /** Total account equity (Total Account Value) in USD. `0` until loaded. */
  readonly equityUsd: number
  readonly isConnected: boolean
  /** True once the first portfolio snapshot has arrived — consumers can render
   *  a skeleton instead of a hard $0 while the venue warms. */
  readonly isLoaded: boolean
}

/**
 * The User's own total account equity, read through the Acting-Address-keyed
 * `portfolio` capability (`ownAccount.portfolio`) so it shows self even while
 * Spectating. Disconnected ⇒ `0` (empty-value wallet gate); a venue without
 * the capability also stays at `0` and never flips `isLoaded`.
 *
 * Consumed by the My Bets "Your cash" header and the app-shell balance chip —
 * one reader, so the two numbers can never disagree.
 */
export function useOwnEquity(): OwnEquityView {
  const portfolio = useOwnCapability('portfolio')
  const isConnected = useIsWalletConnected()
  const [snapshot, setSnapshot] = useState<{ equityUsd: number; isLoaded: boolean }>({
    equityUsd: 0,
    isLoaded: false,
  })

  useEffect(() => {
    if (!portfolio) return
    if (!isConnected) return
    return portfolio.subscribeSnapshot('all', (next) => {
      setSnapshot({ equityUsd: next.accountValue, isLoaded: true })
    })
  }, [portfolio, isConnected])

  if (!isConnected) return { equityUsd: 0, isConnected, isLoaded: false }
  return { equityUsd: snapshot.equityUsd, isConnected, isLoaded: snapshot.isLoaded }
}
