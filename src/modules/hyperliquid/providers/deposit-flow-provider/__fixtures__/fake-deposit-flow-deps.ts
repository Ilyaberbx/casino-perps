import { errAsync, okAsync } from 'neverthrow'
import type { WalletClient } from 'viem'
import type { ChainSwitchOutcome } from '@/modules/account'
import type {
  PortfolioReader,
  PortfolioSnapshot,
  Unsubscribe,
  WalletAddress,
} from '@/modules/shared/domain'
import { uniformPortfolioWindowValues } from '@/modules/shared/domain'
import { HyperliquidDepositError } from '../../../services/hyperliquid-deposit-service.types'
import type {
  HyperliquidDepositService,
} from '../../../services/hyperliquid-deposit-service.types'
import type { DepositFlowDeps } from '../use-deposit-flow'

export const FAKE_ADDRESS = '0x2222222222222222222222222222222222222222' as WalletAddress

const FAKE_WALLET = { account: { address: FAKE_ADDRESS } } as unknown as WalletClient

export interface FakeServiceOverrides {
  usdc?: number
  ethForGas?: number
  chainId?: number
  transferOutcome?: 'ok' | HyperliquidDepositError
  balanceReadOutcome?: 'ok' | HyperliquidDepositError
}

/**
 * A scriptable fake `HyperliquidDepositService`. `readBalances` returns the
 * scripted usdc/eth (mutate `state.usdc` between ticks to simulate funding
 * arriving). The transfer hash is fixed.
 */
export function buildFakeDepositService(overrides: FakeServiceOverrides = {}): {
  service: HyperliquidDepositService
  state: {
    usdc: number
    ethForGas: number
    chainId: number
    // Mutable read error — flip after reaching needs-funding to drive a poll
    // read failure (distinct from a preflight failure, which uses the override).
    balanceReadError: HyperliquidDepositError | null
  }
} {
  const state = {
    usdc: overrides.usdc ?? 0,
    ethForGas: overrides.ethForGas ?? 0.01,
    chainId: overrides.chainId ?? 42161,
    balanceReadError:
      overrides.balanceReadOutcome instanceof HyperliquidDepositError
        ? overrides.balanceReadOutcome
        : null,
  }
  const service: HyperliquidDepositService = {
    readBalances: () =>
      state.balanceReadError !== null
        ? errAsync(state.balanceReadError)
        : okAsync({ usdc: state.usdc, ethForGas: state.ethForGas }),
    readChainId: () => okAsync(state.chainId),
    transfer: () =>
      overrides.transferOutcome instanceof HyperliquidDepositError
        ? errAsync(overrides.transferOutcome)
        : okAsync({ transactionHash: '0xfeed' as `0x${string}` }),
  }
  return { service, state }
}

function buildSnapshot(accountValue: number): PortfolioSnapshot {
  return {
    accountValue,
    pnl: uniformPortfolioWindowValues(0),
    perpsPnl: 0,
    volume: uniformPortfolioWindowValues(0),
    spotEquity: 0,
    perpsEquity: 0,
    fourteenDayVolume: 0,
    timestamp: Date.now(),
  }
}

/**
 * A fake `PortfolioReader` whose `subscribeSnapshot` captures the listener so a
 * test can push account-value snapshots to drive phase-2 (`sent → credited`).
 *
 * Faithful to the real reader (`emitCurrent` in `portfolio-reader.ts`): when a
 * snapshot is already cached, `subscribeSnapshot` emits it SYNCHRONOUSLY to the
 * new listener on subscribe. `setCurrent(value)` primes that cache so the
 * CR-02 pre-broadcast baseline read (`readCurrentAccountValue`) sees a value.
 */
export function buildFakePortfolioReader(): {
  reader: PortfolioReader
  emit: (accountValue: number) => void
  setCurrent: (accountValue: number) => void
  subscriberCount: () => number
} {
  let listener: ((snap: PortfolioSnapshot) => void) | null = null
  let currentValue: number | null = null
  let count = 0
  const reader: PortfolioReader = {
    subscribeSnapshot(_scope, onUpdate): Unsubscribe {
      listener = onUpdate
      count += 1
      if (currentValue !== null) onUpdate(buildSnapshot(currentValue))
      return () => {
        listener = null
        count -= 1
      }
    },
    getHistory: () => okAsync([]),
  }
  const emit = (accountValue: number): void => {
    currentValue = accountValue
    if (listener === null) return
    listener(buildSnapshot(accountValue))
  }
  const setCurrent = (accountValue: number): void => {
    currentValue = accountValue
  }
  return { reader, emit, setCurrent, subscriberCount: () => count }
}

interface CapturedRecord {
  readonly level: string
  readonly fields: Record<string, unknown>
  readonly message: string
}

export function buildFakeFlowLogger(): {
  logger: DepositFlowDeps['logger']
  records: CapturedRecord[]
} {
  const records: CapturedRecord[] = []
  // Faithful to the real logger: child() merges bound fields, call-site wins on
  // key collision. Bound fields (e.g. module, depositId) thus land on records.
  const makeLogger = (bound: Record<string, unknown>): DepositFlowDeps['logger'] => {
    const make =
      (level: string) => (fields: Record<string, unknown>, message: string) => {
        records.push({ level, fields: { ...bound, ...fields }, message })
      }
    return {
      debug: make('debug'),
      info: make('info'),
      warn: make('warn'),
      error: make('error'),
      child: (childFields) => makeLogger({ ...bound, ...childFields }),
    }
  }
  return { logger: makeLogger({}), records }
}

/** A manual interval scheduler so balance-poll ticks are driven by the test. */
export function buildManualScheduler(): {
  setInterval: (handler: () => void, ms: number) => number
  clearInterval: (handle: number) => void
  tick: () => void
  isActive: () => boolean
} {
  let handler: (() => void) | null = null
  return {
    setInterval: (h) => {
      handler = h
      return 1
    },
    clearInterval: () => {
      handler = null
    },
    tick: () => {
      handler?.()
    },
    isActive: () => handler !== null,
  }
}

export function getBroadcastWalletClientStub(): () => Promise<WalletClient | null> {
  return () => Promise.resolve(FAKE_WALLET)
}

/**
 * A fake Privy-native chain switch (ADR-0080) that captures its calls and returns
 * the scripted outcome. The post-switch chain verification reads the fake
 * service's `readChainId` separately — a test drives a real chain change by
 * mutating `state.chainId` (as the switch would), or leaves it stale to exercise
 * the resolved-but-no-op path.
 */
export function buildSwitchMasterWalletChainStub(outcome: ChainSwitchOutcome = 'switched'): {
  switchMasterWalletChain: (master: WalletAddress, chainId: number) => Promise<ChainSwitchOutcome>
  calls: Array<{ master: string; chainId: number }>
} {
  const calls: Array<{ master: string; chainId: number }> = []
  return {
    switchMasterWalletChain: async (master, chainId) => {
      calls.push({ master, chainId })
      return outcome
    },
    calls,
  }
}
