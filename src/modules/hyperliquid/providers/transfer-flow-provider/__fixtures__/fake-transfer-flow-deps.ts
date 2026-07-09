import { errAsync, okAsync } from 'neverthrow'
import type { WalletClient } from 'viem'
import type {
  AccountModeReader,
  Balance,
  BalancesReader,
  PortfolioAccountScope,
  Unsubscribe,
  WalletAddress,
} from '@/modules/shared/domain'
import type { ToastApi, ToastPayload } from '@/modules/shared/services/toast'
import { HyperliquidGatewayError } from '../../../gateway/hyperliquid-gateway.types'
import type { TransferFlowDeps, TransferGateway } from '../use-transfer-flow'

const FAKE_WALLET = { account: { address: '0x1' } } as unknown as WalletClient
const FAKE_MASTER_ADDRESS = '0x1111111111111111111111111111111111111111' as WalletAddress

export interface FakeGatewayOverrides {
  /** When set, `usdClassTransfer` returns this error instead of ok. */
  transferOutcome?: HyperliquidGatewayError
}

export interface CapturedTransferCall {
  readonly amount: string
  readonly toPerp: boolean
}

export function buildFakeTransferGateway(overrides: FakeGatewayOverrides = {}): {
  gateway: TransferGateway
  calls: CapturedTransferCall[]
} {
  const calls: CapturedTransferCall[] = []
  const gateway: TransferGateway = {
    usdClassTransfer: (_wallet, params) => {
      calls.push({ amount: params.amount, toPerp: params.toPerp })
      return overrides.transferOutcome ? errAsync(overrides.transferOutcome) : okAsync(undefined)
    },
  }
  return { gateway, calls }
}

function usdcRow(available: number): Balance {
  return {
    asset: 'USDC',
    amount: available,
    available,
    amountUsd: available,
    pnlPct: null,
    source: 'spot',
  }
}

/**
 * A balances reader that immediately emits the configured USDC available per
 * scope on subscribe (faithful to the real reader's synchronous emit when a
 * snapshot is cached). `scope === 'perps'` emits `perpsAvailable`, else
 * `spotAvailable`.
 */
export function buildFakeBalancesReader(spotAvailable: number, perpsAvailable: number): BalancesReader {
  return {
    subscribe(scope: PortfolioAccountScope, onUpdate): Unsubscribe {
      const available = scope === 'perps' ? perpsAvailable : spotAvailable
      onUpdate([usdcRow(available)])
      return () => {}
    },
  }
}

export function buildFakeAccountModeReader(isSegregated: boolean): AccountModeReader {
  return {
    current: () => ({ isSegregated }),
    subscribe: () => () => {},
  }
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
  logger: TransferFlowDeps['logger']
  records: CapturedRecord[]
} {
  const records: CapturedRecord[] = []
  const makeLogger = (bound: Record<string, unknown>): TransferFlowDeps['logger'] => {
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
  spotAvailable?: number
  perpsAvailable?: number
  isSegregated?: boolean
  transferOutcome?: HyperliquidGatewayError
  masterWallet?: WalletClient | null
  /**
   * The resolved Selected-Wallet master (ADR-0060). Defaults to a non-null fake;
   * pass `null` to simulate no resolvable master (submit aborts before signing).
   */
  masterAddress?: WalletAddress | null
  prefill?: TransferFlowDeps['prefill']
}

export interface DepsHarness {
  deps: TransferFlowDeps
  calls: CapturedTransferCall[]
  toast: CapturedToast
  records: CapturedRecord[]
  closeCount: () => number
  warnsFor: (message: string) => CapturedRecord[]
}

export function buildTransferDeps(options: BuildDepsOptions = {}): DepsHarness {
  const { gateway, calls } = buildFakeTransferGateway({ transferOutcome: options.transferOutcome })
  const { toast, captured } = buildFakeToast()
  const { logger, records } = buildFakeFlowLogger()
  const masterWallet = options.masterWallet === undefined ? FAKE_WALLET : options.masterWallet
  const masterAddress =
    options.masterAddress === undefined ? FAKE_MASTER_ADDRESS : options.masterAddress
  const closes = { count: 0 }
  const deps: TransferFlowDeps = {
    gateway,
    balances: buildFakeBalancesReader(options.spotAvailable ?? 100, options.perpsAvailable ?? 50),
    accountMode: buildFakeAccountModeReader(options.isSegregated ?? true),
    getMasterViemAccount: async () => masterWallet,
    masterAddress,
    toast,
    onSuccess: () => {
      closes.count += 1
    },
    logger,
    prefill: options.prefill ?? null,
  }
  return {
    deps,
    calls,
    toast: captured,
    records,
    closeCount: () => closes.count,
    warnsFor: (message) => records.filter((r) => r.level === 'warn' && r.message === message),
  }
}

export const TRANSFER_ERROR = (kind: ConstructorParameters<typeof HyperliquidGatewayError>[0]) =>
  new HyperliquidGatewayError(kind, `${kind} error`)
