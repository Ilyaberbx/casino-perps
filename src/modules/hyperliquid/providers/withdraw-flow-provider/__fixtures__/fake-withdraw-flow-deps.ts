import { errAsync, okAsync } from 'neverthrow'
import type { WalletClient } from 'viem'
import type { WalletAddress } from '@/modules/shared/domain'
import type { ToastApi, ToastPayload } from '@/modules/shared/services/toast'
import { HyperliquidGatewayError } from '../../../gateway/hyperliquid-gateway.types'
import type { WithdrawFlowDeps, WithdrawGateway } from '../use-withdraw-flow'

const FAKE_WALLET = { account: { address: '0x1' } } as unknown as WalletClient
const FAKE_MASTER_ADDRESS = '0x1111111111111111111111111111111111111111' as WalletAddress

export interface FakeGatewayOverrides {
  /** When set, `withdraw3` returns this error instead of ok. */
  withdrawOutcome?: HyperliquidGatewayError
}

export interface CapturedWithdrawCall {
  readonly destination: string
  readonly amount: string
}

export function buildFakeWithdrawGateway(overrides: FakeGatewayOverrides = {}): {
  gateway: WithdrawGateway
  calls: CapturedWithdrawCall[]
} {
  const calls: CapturedWithdrawCall[] = []
  const gateway: WithdrawGateway = {
    withdraw3: (_wallet, params) => {
      calls.push({ destination: params.destination, amount: params.amount })
      return overrides.withdrawOutcome ? errAsync(overrides.withdrawOutcome) : okAsync(undefined)
    },
  }
  return { gateway, calls }
}

export interface CapturedToast {
  payloads: ToastPayload[]
}

export function buildFakeToast(): { toast: ToastApi; captured: CapturedToast } {
  const captured: CapturedToast = { payloads: [] }
  const toast: ToastApi = {
    show(payload) {
      captured.payloads.push(payload)
      return 'fake-id'
    },
    dismiss() {},
    dismissAll() {},
  }
  return { toast, captured }
}

interface CapturedRecord {
  readonly level: string
  readonly fields: Record<string, unknown>
  readonly message: string
}

export function buildFakeFlowLogger(): {
  logger: WithdrawFlowDeps['logger']
  records: CapturedRecord[]
} {
  const records: CapturedRecord[] = []
  const makeLogger = (bound: Record<string, unknown>): WithdrawFlowDeps['logger'] => {
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

export interface BuildDepsOptions {
  withdrawableUsdc?: number
  withdrawOutcome?: HyperliquidGatewayError
  masterWallet?: WalletClient | null
  /**
   * The resolved Selected-Wallet master. Defaults to a non-null fake; pass `null`
   * to simulate no resolvable master (submit aborts; `isApplicable` is false).
   */
  masterAddress?: WalletAddress | null
}

export interface DepsHarness {
  deps: WithdrawFlowDeps
  calls: CapturedWithdrawCall[]
  toast: CapturedToast
  records: CapturedRecord[]
  recordedRecipients: string[]
  successCount: () => number
  warnsFor: (message: string) => CapturedRecord[]
}

export function buildWithdrawDeps(options: BuildDepsOptions = {}): DepsHarness {
  const { gateway, calls } = buildFakeWithdrawGateway({ withdrawOutcome: options.withdrawOutcome })
  const { toast, captured } = buildFakeToast()
  const { logger, records } = buildFakeFlowLogger()
  const masterWallet = options.masterWallet === undefined ? FAKE_WALLET : options.masterWallet
  const masterAddress =
    options.masterAddress === undefined ? FAKE_MASTER_ADDRESS : options.masterAddress
  const successes = { count: 0 }
  const recordedRecipients: string[] = []
  const deps: WithdrawFlowDeps = {
    gateway,
    getMasterViemAccount: async () => masterWallet,
    masterAddress,
    withdrawableUsdc: options.withdrawableUsdc ?? 100,
    walletSuggestions: [],
    recentSuggestions: [],
    onRecordRecipient: (address) => {
      recordedRecipients.push(address)
    },
    toast,
    onSuccess: () => {
      successes.count += 1
    },
    logger,
  }
  return {
    deps,
    calls,
    toast: captured,
    records,
    recordedRecipients,
    successCount: () => successes.count,
    warnsFor: (message) => records.filter((r) => r.level === 'warn' && r.message === message),
  }
}

export const WITHDRAW_ERROR = (kind: ConstructorParameters<typeof HyperliquidGatewayError>[0]) =>
  new HyperliquidGatewayError(kind, `${kind} error`)

/** A valid distinct 0x destination (not the master) for the "edited" path. */
export const OTHER_ADDRESS = '0x2222222222222222222222222222222222222222'
