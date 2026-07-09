import { errAsync, okAsync } from 'neverthrow'
import type { WalletClient } from 'viem'
import type { WalletAddress } from '@/modules/shared/domain'
import type { ToastApi, ToastPayload } from '@/modules/shared/services/toast'
import { HyperliquidGatewayError } from '../../../gateway/hyperliquid-gateway.types'
import type { RecipientSuggestion } from '@/modules/shared/components/recipient-combobox'
import type { SendableToken } from '../send-flow-provider.types'
import type { SendFlowDeps, SendGateway } from '../use-send-flow'

/** The spot arm of `SendableToken`, narrowed for fixtures that read `tokenId`. */
type SpotSendableToken = Extract<SendableToken, { kind: 'spot' }>

const FAKE_WALLET = { account: { address: '0x1' } } as unknown as WalletClient
const FAKE_MASTER_ADDRESS = '0x1111111111111111111111111111111111111111' as WalletAddress

/** A valid distinct 0x recipient (not the master) for the happy path. */
export const OTHER_ADDRESS = '0x2222222222222222222222222222222222222222'

export const USDC_TOKEN: SendableToken = {
  key: 'usd',
  kind: 'usd',
  symbol: 'USDC',
  available: 100,
  decimals: 6,
}

export const HYPE_TOKEN: SpotSendableToken = {
  key: 'spot:HYPE',
  kind: 'spot',
  symbol: 'HYPE',
  available: 50,
  decimals: 8,
  tokenId: 'HYPE:0x0d01dc56dcaaca66ad901c959b4011ec',
}

export interface FakeGatewayOverrides {
  /** When set, the routed send returns this error instead of ok. */
  sendOutcome?: HyperliquidGatewayError
}

export interface CapturedUsdSend {
  readonly destination: string
  readonly amount: string
}

export interface CapturedSpotSend {
  readonly destination: string
  readonly token: string
  readonly amount: string
}

export function buildFakeSendGateway(overrides: FakeGatewayOverrides = {}): {
  gateway: SendGateway
  usdCalls: CapturedUsdSend[]
  spotCalls: CapturedSpotSend[]
} {
  const usdCalls: CapturedUsdSend[] = []
  const spotCalls: CapturedSpotSend[] = []
  const gateway: SendGateway = {
    usdSend: (_wallet, params) => {
      usdCalls.push({ destination: params.destination, amount: params.amount })
      return overrides.sendOutcome ? errAsync(overrides.sendOutcome) : okAsync(undefined)
    },
    spotSend: (_wallet, params) => {
      spotCalls.push({
        destination: params.destination,
        token: params.token,
        amount: params.amount,
      })
      return overrides.sendOutcome ? errAsync(overrides.sendOutcome) : okAsync(undefined)
    },
  }
  return { gateway, usdCalls, spotCalls }
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
  logger: SendFlowDeps['logger']
  records: CapturedRecord[]
} {
  const records: CapturedRecord[] = []
  const makeLogger = (bound: Record<string, unknown>): SendFlowDeps['logger'] => {
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
  tokens?: ReadonlyArray<SendableToken>
  sendOutcome?: HyperliquidGatewayError
  masterWallet?: WalletClient | null
  /**
   * The resolved Selected-Wallet master. Defaults to a non-null fake; pass `null`
   * to simulate no resolvable master (submit aborts; `isApplicable` is false).
   */
  masterAddress?: WalletAddress | null
  /** The spot-meta fetch status — defaults to `ready`. */
  metaStatus?: 'loading' | 'error' | 'ready'
  /** Recipient suggestions from the user's own wallets (default empty). */
  walletSuggestions?: ReadonlyArray<RecipientSuggestion>
  /** Recipient suggestions from recently-sent addresses (default empty). */
  recentSuggestions?: ReadonlyArray<RecipientSuggestion>
}

export interface DepsHarness {
  deps: SendFlowDeps
  usdCalls: CapturedUsdSend[]
  spotCalls: CapturedSpotSend[]
  toast: CapturedToast
  records: CapturedRecord[]
  recordedRecipients: string[]
  successCount: () => number
  warnsFor: (message: string) => CapturedRecord[]
}

export function buildSendDeps(options: BuildDepsOptions = {}): DepsHarness {
  const { gateway, usdCalls, spotCalls } = buildFakeSendGateway({ sendOutcome: options.sendOutcome })
  const { toast, captured } = buildFakeToast()
  const { logger, records } = buildFakeFlowLogger()
  const masterWallet = options.masterWallet === undefined ? FAKE_WALLET : options.masterWallet
  const masterAddress =
    options.masterAddress === undefined ? FAKE_MASTER_ADDRESS : options.masterAddress
  const successes = { count: 0 }
  const recordedRecipients: string[] = []
  const deps: SendFlowDeps = {
    gateway,
    getMasterViemAccount: async () => masterWallet,
    masterAddress,
    tokens: options.tokens ?? [USDC_TOKEN, HYPE_TOKEN],
    walletSuggestions: options.walletSuggestions ?? [],
    recentSuggestions: options.recentSuggestions ?? [],
    onRecordRecipient: (address) => {
      recordedRecipients.push(address)
    },
    metaStatus: options.metaStatus ?? 'ready',
    retryAssets: () => {},
    toast,
    onSuccess: () => {
      successes.count += 1
    },
    logger,
  }
  return {
    deps,
    usdCalls,
    spotCalls,
    toast: captured,
    records,
    recordedRecipients,
    successCount: () => successes.count,
    warnsFor: (message) => records.filter((r) => r.level === 'warn' && r.message === message),
  }
}

export const SEND_ERROR = (kind: ConstructorParameters<typeof HyperliquidGatewayError>[0]) =>
  new HyperliquidGatewayError(kind, `${kind} error`)
