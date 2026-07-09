import type { ResyncSignal, WalletAddress } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { HyperliquidAgentWallet } from './gateway'

export type HyperliquidNetwork = 'mainnet' | 'testnet'

export interface HyperliquidConfig {
  readonly network: HyperliquidNetwork
  readonly apiHttpUrl: string
  readonly apiWsUrl: string
}

export type HyperliquidConfigErrorKind =
  | 'missing-network'
  | 'invalid-network'
  | 'invalid-url'

export class HyperliquidConfigError extends Error {
  readonly kind: HyperliquidConfigErrorKind
  constructor(kind: HyperliquidConfigErrorKind, message: string) {
    super(message)
    this.kind = kind
    this.name = 'HyperliquidConfigError'
  }
}

export interface HyperliquidVenueOptions {
  readonly network: HyperliquidNetwork
  readonly apiHttpUrl: string
  readonly apiWsUrl: string
  readonly getAddress: () => WalletAddress | null
  /**
   * Resolve the **Acting Address** (always the connected Primary Wallet, never a
   * Spectated Address) — keys the order-flow `ownAccount` capability group so
   * validation/preview/leverage/fees reflect the User's own account while
   * Spectating (ADR-0038). Optional — when omitted it defaults to `getAddress`
   * so mock-venue / tests with no spectate concept see acting === viewing and
   * the order data is unchanged.
   */
  readonly getActingAddress?: () => WalletAddress | null
  readonly logger: Logger
  /**
   * Resolve the agent signing wallet at signing time, or `null` when no
   * approved agent is available. Bridged from `AgentWalletProvider` via the
   * app-scope signing-wallet holder so wallet/agent changes never rebuild the
   * venue. Optional — when omitted the `trader` capability still declares
   * (HL *can* trade), but every signed action returns a typed `rejected`
   * error rather than throwing or leaking. The signing wallet is built lazily
   * per call; the private key never enters the venue, React state, or logs.
   */
  readonly getAgentWallet?: () => HyperliquidAgentWallet | null
  /**
   * Liveness source from the app-scope connection-liveness coordinator, fanned
   * into every stream reader's `withReconnect` so a tab-resume / network-online
   * forces a resync of a silently-dead socket (ADR-0041). Optional — omitted by
   * tests, where streams just rely on the `failureSignal` reconnect path.
   */
  readonly resyncSignal?: ResyncSignal
  /**
   * Stamp "last activity" on every inbound WS event — wired into the gateway
   * fanout (the shared-transport chokepoint) so the coordinator's staleness
   * probe knows whether the socket is alive (ADR-0041). Optional.
   */
  readonly notifyActivity?: () => void
}
