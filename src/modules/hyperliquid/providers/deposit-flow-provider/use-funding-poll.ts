import { useEffect } from 'react'
import type { WalletAddress } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { HyperliquidDepositService } from '../../services/hyperliquid-deposit-service.types'
import type { DepositFlowAction, DepositPhase } from './deposit-flow-provider.types'
import { hasFundingForDeposit } from './deposit-flow.utils'

export interface FundingPollOptions {
  readonly phase: DepositPhase
  readonly service: HyperliquidDepositService
  readonly address: WalletAddress | null
  readonly log: Logger
  readonly pollMs: number
  readonly setIntervalFn: (handler: () => void, ms: number) => number
  readonly clearIntervalFn: (handle: number) => void
  readonly dispatch: (action: DepositFlowAction) => void
}

/**
 * Live wallet-balance poll while in `needs-funding`. When the balance crosses
 * the minimum, auto-advance to `ready` with no reload. A transient read failure
 * warns but keeps polling — it must never strand the user on a stale balance.
 */
export function useFundingPoll(options: FundingPollOptions): void {
  const { phase, service, address, log, pollMs, setIntervalFn, clearIntervalFn, dispatch } = options

  useEffect(() => {
    const isWatchingFunding = phase === 'needs-funding'
    if (!isWatchingFunding) return
    if (address === null) return

    const tick = (): void => {
      void service
        .readBalances(address)
        .map((balances) => {
          const nowFunded = hasFundingForDeposit(balances.usdc)
          if (nowFunded) {
            log.info({ usdc: balances.usdc }, 'funding arrived')
            dispatch({ type: 'FUNDING_ARRIVED', walletUsdc: balances.usdc })
            return
          }
          dispatch({ type: 'BALANCE_TICK', walletUsdc: balances.usdc })
        })
        .mapErr((err) => {
          log.warn({ kind: err.kind, errorMessage: err.message }, 'funding poll read failed')
        })
    }
    const handle = setIntervalFn(tick, pollMs)
    return () => clearIntervalFn(handle)
  }, [phase, service, address, pollMs, setIntervalFn, clearIntervalFn, log, dispatch])
}
