import { errAsync, okAsync } from 'neverthrow'
import type { WalletClient } from 'viem'
import type { ChainSwitchOutcome } from '@/modules/account'
import type { WalletAddress } from '@/modules/shared/domain'
import type { ToastApi, ToastPayload } from '@/modules/shared/services/toast'
import { HyperliquidGatewayError } from '../../../gateway/hyperliquid-gateway.types'
import {
  HyperEvmCoreError,
  type HyperEvmCoreService,
} from '../../../services/hyperevm-core-service.types'
import type { EvmCoreToken } from '../evm-core-flow-provider.types'
import type { EvmCoreFlowDeps, EvmCoreGateway } from '../use-evm-core-flow'

/** The HyperEVM chain id used by the fakes (mainnet). */
export const FAKE_HYPEREVM_CHAIN_ID = 999

/** The mined HyperEVM tx hash the fake EVM service returns. */
export const FAKE_EVM_TX_HASH = '0xeeee' as `0x${string}`

const FAKE_WALLET = { account: { address: '0x1' } } as unknown as WalletClient
export const FAKE_MASTER_ADDRESS = '0x1111111111111111111111111111111111111111' as WalletAddress

/** A standard EVM-linked token (index 197, an ERC20 with a contract). */
export const UBTC_TOKEN: EvmCoreToken = {
  key: 'evm-core:BTC',
  symbol: 'BTC',
  name: 'UBTC',
  index: 197,
  tokenId: 'UBTC:0x8f254b963e8468305d409b33aa137c67',
  available: 2,
  decimals: 8,
  isHype: false,
  evmExtraWeiDecimals: 0,
  evmAddress: '0x8f254b963e8468305d409b33aa137c67aabbccdd',
}

/** HYPE — the native gas token routed to the special `0x2222…2222` system address. */
export const HYPE_TOKEN: EvmCoreToken = {
  key: 'evm-core:HYPE',
  symbol: 'HYPE',
  name: 'HYPE',
  index: 150,
  tokenId: 'HYPE:0x0d01dc56dcaaca66ad901c959b4011ec',
  available: 50,
  decimals: 8,
  isHype: true,
  evmExtraWeiDecimals: 10,
  evmAddress: null,
}

/** The token system address BTC's funds are sent to (index 197 → …c5). */
export const UBTC_SYSTEM_ADDRESS = '0x20000000000000000000000000000000000000c5'

export interface FakeGatewayOverrides {
  /** When set, the routed `spotSend` returns this error instead of ok. */
  sendOutcome?: HyperliquidGatewayError
}

export interface CapturedSpotSend {
  readonly destination: string
  readonly token: string
  readonly amount: string
}

export function buildFakeEvmCoreGateway(overrides: FakeGatewayOverrides = {}): {
  gateway: EvmCoreGateway
  spotCalls: CapturedSpotSend[]
} {
  const spotCalls: CapturedSpotSend[] = []
  const gateway: EvmCoreGateway = {
    spotSend: (_wallet, params) => {
      spotCalls.push({
        destination: params.destination,
        token: params.token,
        amount: params.amount,
      })
      return overrides.sendOutcome ? errAsync(overrides.sendOutcome) : okAsync(undefined)
    },
  }
  return { gateway, spotCalls }
}

export interface CapturedEvmTransfer {
  readonly kind: 'erc20' | 'native'
  readonly to: string
  readonly rawAmount: bigint
}

/** A mutable chain ref so a fake switch can flip what `readChainId` reports. */
export interface FakeChainRef {
  current: number
}

export interface FakeEvmServiceOptions {
  /** Chain the wallet reports — default the HyperEVM mainnet id (ready path). */
  chainId?: number
  /** Native HYPE balance (gas) — default 1 (has gas). 0 ⇒ no-gas. */
  nativeBalance?: number
  /** ERC20 balance returned for any token — default 10. */
  erc20Balance?: number
  /** When set, the routed transfer (erc20/native) returns this error. */
  transferOutcome?: HyperEvmCoreError
  /** Shared chain ref — `readChainId` reads `.current` so a fake switch can flip it. */
  chainRef?: FakeChainRef
}

export function buildFakeEvmService(options: FakeEvmServiceOptions = {}): {
  service: HyperEvmCoreService
  transfers: CapturedEvmTransfer[]
} {
  const transfers: CapturedEvmTransfer[] = []
  const chainRef = options.chainRef ?? { current: options.chainId ?? FAKE_HYPEREVM_CHAIN_ID }
  const nativeBalance = options.nativeBalance ?? 1
  const erc20Balance = options.erc20Balance ?? 10
  const service: HyperEvmCoreService = {
    readNativeBalance: () => okAsync(nativeBalance),
    readErc20Balance: () => okAsync(erc20Balance),
    readChainId: () => okAsync(chainRef.current),
    transferErc20: (_wallet, req) => {
      transfers.push({ kind: 'erc20', to: req.systemAddress, rawAmount: req.rawAmount })
      return options.transferOutcome
        ? errAsync(options.transferOutcome)
        : okAsync({ transactionHash: FAKE_EVM_TX_HASH })
    },
    sendNativeHype: (_wallet, req) => {
      transfers.push({ kind: 'native', to: req.to, rawAmount: req.weiAmount })
      return options.transferOutcome
        ? errAsync(options.transferOutcome)
        : okAsync({ transactionHash: FAKE_EVM_TX_HASH })
    },
  }
  return { service, transfers }
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
  logger: EvmCoreFlowDeps['logger']
  records: CapturedRecord[]
} {
  const records: CapturedRecord[] = []
  const makeLogger = (bound: Record<string, unknown>): EvmCoreFlowDeps['logger'] => {
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
  /** Core→EVM token list (held HyperCore holdings). Defaults to [UBTC, HYPE]. */
  coreTokens?: ReadonlyArray<EvmCoreToken>
  /** EVM→Core token list (full EVM-linked universe). Defaults to [UBTC, HYPE]. */
  evmTokens?: ReadonlyArray<EvmCoreToken>
  sendOutcome?: HyperliquidGatewayError
  masterWallet?: WalletClient | null
  broadcastWallet?: WalletClient | null
  /** Fake EVM service config (chain/gas/balance/outcomes). */
  evm?: FakeEvmServiceOptions
  /** Outcome the fake `switchMasterWalletChain` returns — default `'switched'`. */
  switchOutcome?: ChainSwitchOutcome
  /**
   * Whether a `'switched'` outcome actually flips the chain the service reports to
   * the target (the happy path). Default `true`; set `false` to simulate the
   * embedded-wallet no-op (resolves `'switched'` but chain is unchanged).
   */
  switchChangesChain?: boolean
  /**
   * The resolved Selected-Wallet master. Defaults to a non-null fake; pass `null`
   * to simulate no resolvable master (submit aborts; `isApplicable` is false).
   */
  masterAddress?: WalletAddress | null
  /** The spot-meta fetch status — defaults to `ready`. */
  metaStatus?: 'loading' | 'error' | 'ready'
}

export interface CapturedChainSwitch {
  readonly master: string
  readonly chainId: number
}

export interface DepsHarness {
  deps: EvmCoreFlowDeps
  spotCalls: CapturedSpotSend[]
  evmTransfers: CapturedEvmTransfer[]
  switchCalls: CapturedChainSwitch[]
  toast: CapturedToast
  records: CapturedRecord[]
  successCount: () => number
  warnsFor: (message: string) => CapturedRecord[]
}

export function buildEvmCoreDeps(options: BuildDepsOptions = {}): DepsHarness {
  const { gateway, spotCalls } = buildFakeEvmCoreGateway({ sendOutcome: options.sendOutcome })
  // Shared chain ref: seeds from the evm service's chainId so a fake switch can
  // flip what the post-switch `readChainId` verification reads.
  const chainRef: FakeChainRef = { current: options.evm?.chainId ?? FAKE_HYPEREVM_CHAIN_ID }
  const { service, transfers } = buildFakeEvmService({ ...options.evm, chainRef })
  const { toast, captured } = buildFakeToast()
  const { logger, records } = buildFakeFlowLogger()
  const masterWallet = options.masterWallet === undefined ? FAKE_WALLET : options.masterWallet
  const broadcastWallet =
    options.broadcastWallet === undefined ? FAKE_WALLET : options.broadcastWallet
  const masterAddress =
    options.masterAddress === undefined ? FAKE_MASTER_ADDRESS : options.masterAddress
  const successes = { count: 0 }
  const switchCalls: CapturedChainSwitch[] = []
  const switchOutcome = options.switchOutcome ?? 'switched'
  const switchChangesChain = options.switchChangesChain ?? true
  const deps: EvmCoreFlowDeps = {
    gateway,
    evmService: service,
    getMasterViemAccount: async () => masterWallet,
    getBroadcastWalletClient: async () => broadcastWallet,
    switchMasterWalletChain: async (master, chainId) => {
      switchCalls.push({ master, chainId })
      const landed = switchOutcome === 'switched' && switchChangesChain
      if (landed) chainRef.current = chainId
      return switchOutcome
    },
    masterAddress,
    coreTokens: options.coreTokens ?? [UBTC_TOKEN, HYPE_TOKEN],
    evmTokens: options.evmTokens ?? [UBTC_TOKEN, HYPE_TOKEN],
    hyperEvmChainId: FAKE_HYPEREVM_CHAIN_ID,
    explorerTxUrl: (hash) => `https://purrsec.com/tx/${hash}`,
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
    spotCalls,
    evmTransfers: transfers,
    switchCalls,
    toast: captured,
    records,
    successCount: () => successes.count,
    warnsFor: (message) => records.filter((r) => r.level === 'warn' && r.message === message),
  }
}

export const EVM_SERVICE_ERROR = (
  kind: ConstructorParameters<typeof HyperEvmCoreError>[0],
) => new HyperEvmCoreError(kind, `${kind} error`)

export const EVM_CORE_ERROR = (
  kind: ConstructorParameters<typeof HyperliquidGatewayError>[0],
) => new HyperliquidGatewayError(kind, `${kind} error`)
