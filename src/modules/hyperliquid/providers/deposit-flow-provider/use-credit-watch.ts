import { useCallback, useEffect, useRef } from 'react'
import type { PortfolioReader } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { DepositFlowAction, DepositPhase } from './deposit-flow-provider.types'
import { CREDIT_TOLERANCE } from './deposit-flow.constants'
import { readCurrentAccountValue } from './deposit-flow.utils'

export interface CreditWatchOptions {
  readonly phase: DepositPhase
  readonly portfolioReader: PortfolioReader | null
  readonly log: Logger
  readonly dispatch: (action: DepositFlowAction) => void
}

/**
 * Owns phase-2 credit detection (WR-DF-07): the pre-broadcast credit-target ref
 * and the `sent → credited` subscription to the EXISTING live account-value
 * reader (no new gateway method, no ledger polling — ADR-0028).
 *
 * CR-02: `captureBaseline(amount)` must be called in `submit` BEFORE broadcasting
 * the transfer. It samples the reader's current account value and stores
 * `baseline + amount * CREDIT_TOLERANCE` as the target. The watcher then flips
 * to `credited` only when the live value reaches that target — tying completion
 * to THIS deposit rather than "any strict rise after the first post-sent
 * snapshot" (which both stranded fast credits and false-fired on unrelated PnL).
 */
export function useCreditWatch(options: CreditWatchOptions): {
  captureBaseline(depositAmount: number): void
} {
  const { phase, portfolioReader, log, dispatch } = options

  // The credit target captured BEFORE broadcasting the transfer. `null` when no
  // reader was available at submit time — then there is nothing to compare against.
  const creditTargetRef = useRef<number | null>(null)

  const captureBaseline = useCallback(
    (depositAmount: number): void => {
      const preBroadcastValue = readCurrentAccountValue(portfolioReader)
      creditTargetRef.current =
        preBroadcastValue === null ? null : preBroadcastValue + depositAmount * CREDIT_TOLERANCE
      log.debug({ preBroadcastValue, targetValue: creditTargetRef.current }, 'credit target')
    },
    [portfolioReader, log],
  )

  useEffect(() => {
    const isAwaitingCredit = phase === 'sent'
    if (!isAwaitingCredit) return
    if (portfolioReader === null) return

    const unsubscribe = portfolioReader.subscribeSnapshot('all', (snapshot) => {
      const targetValue = creditTargetRef.current
      if (targetValue === null) return
      const hasReachedTarget = snapshot.accountValue >= targetValue
      if (hasReachedTarget) {
        log.info({ accountValue: snapshot.accountValue, targetValue }, 'credited')
        dispatch({ type: 'CREDITED' })
      }
    })
    return unsubscribe
  }, [phase, portfolioReader, log, dispatch])

  return { captureBaseline }
}
