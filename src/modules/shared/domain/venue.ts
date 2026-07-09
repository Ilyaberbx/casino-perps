import type { ConnectionStatusSource } from './capabilities/connection-status-source'
import type { PortfolioReader } from './capabilities/portfolio-reader'
import type { EquityExtensionsReader } from './capabilities/equity-extensions-reader'
import type { MarginSummaryReader } from './capabilities/margin-summary-reader'
import type { FeeScheduleReader } from './capabilities/fee-schedule-reader'
import type { VolumeHistoryReader } from './capabilities/volume-history-reader'
import type { BalancesReader } from './capabilities/balances-reader'
import type { AccountModeReader } from './capabilities/account-mode-reader'
import type { PositionsReader } from './capabilities/positions-reader'
import type { PerpsPositionsSnapshotReader } from './capabilities/perps-positions-snapshot-reader'
import type { OpenOrdersReader } from './capabilities/open-orders-reader'
import type { OpenOrdersSnapshotReader } from './capabilities/open-orders-snapshot-reader'
import type { TwapActiveSnapshotReader } from './capabilities/twap-active-snapshot-reader'
import type { TwapHistoryReader } from './capabilities/twap-history-reader'
import type { TwapSliceFillsReader } from './capabilities/twap-slice-fills-reader'
import type { TwapController } from './capabilities/twap-controller'
import type { TradeHistoryReader } from './capabilities/trade-history-reader'
import type { FundingHistoryReader } from './capabilities/funding-history-reader'
import type { OrderHistoryReader } from './capabilities/order-history-reader'
import type { InterestHistoryReader } from './capabilities/interest-history-reader'
import type { AccountActivityReader } from './capabilities/account-activity-reader'
import type { FillsReader } from './capabilities/fills-reader'
import type { Trader } from './capabilities/trader'
import type { LeverageController } from './capabilities/leverage-controller'
import type { MarginModeController } from './capabilities/margin-mode-controller'
import type { PositionProtection } from './capabilities/position-protection'
import type { CandlesReader } from './capabilities/candles-reader'
import type { MarketDataReader } from './capabilities/market-data-reader'
import type { FC, ReactNode } from 'react'
import type { VenueOnboarding } from './venue-onboarding'
import type { VenueDepositCapability } from './venue-deposit'
import type { VenueTransferCapability } from './venue-transfer'
import type { VenueWithdrawCapability } from './venue-withdraw'
import type { VenueSendCapability } from './venue-send'
import type { VenueEvmCoreCapability } from './venue-evm-core'
import type { VenueHip3AbstractionCapability } from './venue-hip3-abstraction'

export type VenueId = string

/**
 * Hook-shaped onboarding capability. Sits on `Venue` (not in
 * `VenueCapabilities`) because the live value is React-bound: the
 * `VenueOnboarding` is composed from React provider state inside the venue
 * module, so consumers reach it through a hook rather than a pre-built object.
 * `app/` mounts `<provider>` once per venue; capability-presence narrowing
 * happens on `venue.onboarding`. See ADR-0026.
 */
export interface VenueOnboardingCapability {
  readonly provider: FC<{ children: ReactNode }>
  useVenueOnboarding(): VenueOnboarding
}

/**
 * The account-state readers the **order flow** and the **Manage Funds** money-
 * moving flows (Deposit/Withdraw/Transfer/Send/EVM⇄Core) consume, keyed to the
 * **Acting Address** (always the connected Primary Wallet, never a Spectated
 * Address). A fixed, named group — not a per-call address parameter — preserves
 * ADR-0021's rejection of threading an address through ~30 capability methods
 * (ADR-0038 D-1).
 *
 * While not spectating these readers alias the venue's viewing-keyed instances
 * (zero extra subscriptions; ADR-0038 D-2). While spectating they diverge to a
 * second, connected-keyed account-stream set so order entry / Manage Funds shows
 * the User's own account even though the dock shows the Spectated Address's.
 * Absent on venues with no address concept that nonetheless want self-keyed
 * order data (mock-venue aliases its own readers into this group, ADR-0038 D-5).
 */
export interface OwnAccountCapabilities {
  readonly portfolio: PortfolioReader
  readonly balances: BalancesReader
  readonly perpsPositionsSnapshot: PerpsPositionsSnapshotReader
  readonly feeSchedule: FeeScheduleReader
  readonly accountMode: AccountModeReader
}

export interface VenueMetadata {
  readonly id: VenueId
  readonly label: string
  /**
   * Builds a public block-explorer URL for a venue transaction hash.
   * Optional — venues without an explorer (e.g. mock-venue) omit it; the UI
   * hides the link in that case.
   */
  readonly explorerTxUrl?: (transactionHash: string) => string
}

export interface VenueCapabilities {
  readonly connection: ConnectionStatusSource
  readonly portfolio?: PortfolioReader
  readonly equityExtensions?: EquityExtensionsReader
  readonly marginSummary?: MarginSummaryReader
  readonly feeSchedule?: FeeScheduleReader
  readonly volumeHistory?: VolumeHistoryReader
  readonly balances?: BalancesReader
  /**
   * Whether the account keeps Spot/Perp segregated (classic) vs unified/
   * portfolio margin. Drives the Transfer affordance and unified-aware balance
   * display. Absent ⇒ treat as segregated. See ADR-0033.
   */
  readonly accountMode?: AccountModeReader
  readonly positions?: PositionsReader
  readonly perpsPositionsSnapshot?: PerpsPositionsSnapshotReader
  readonly openOrders?: OpenOrdersReader
  readonly openOrdersSnapshot?: OpenOrdersSnapshotReader
  readonly twapActiveSnapshot?: TwapActiveSnapshotReader
  readonly twapHistory?: TwapHistoryReader
  readonly twapSliceFills?: TwapSliceFillsReader
  readonly twapController?: TwapController
  readonly tradeHistory?: TradeHistoryReader
  readonly fundingHistory?: FundingHistoryReader
  readonly orderHistory?: OrderHistoryReader
  readonly interestHistory?: InterestHistoryReader
  readonly accountActivity?: AccountActivityReader
  readonly fills?: FillsReader
  readonly trader?: Trader
  readonly leverageController?: LeverageController
  readonly marginModeController?: MarginModeController
  readonly positionProtection?: PositionProtection
  readonly candles?: CandlesReader
  readonly marketData?: MarketDataReader
  /**
   * Acting-Address-keyed account readers for the order flow (ADR-0038 D-1).
   * The order entry sheet, draft validation, order preview, max-size slider,
   * fee estimate, and leverage/margin-mode seed read these so they reflect the
   * authenticated User's own account even while Spectating. Absent on venues
   * that expose no account state at all.
   */
  readonly ownAccount?: OwnAccountCapabilities
}

export interface Venue {
  readonly metadata: VenueMetadata
  readonly capabilities: VenueCapabilities
  /**
   * Tears down all venue-owned live resources (WebSocket streams, pull
   * timers). Idempotent — safe to call more than once. Optional: venues
   * with no live resources (e.g. mock-venue) may omit it. The composition
   * root calls this on venue switch / unmount. See
   * docs/adr/0015-venue-dispose-lifecycle.md.
   */
  readonly dispose?: () => void
  /**
   * Hint to the venue that the wallet address callback may now return a
   * different value. Venues that hold an address-bound live subscription
   * (e.g. Hyperliquid's `webData2`) should re-evaluate and re-subscribe.
   * The composition root calls this from the same effect that mirrors
   * `useAuth().primaryWalletAddress` into the address holder — wallet
   * rotation must NOT rebuild the venue, so we notify it instead.
   * Idempotent on no-op rotations; venues with no address-bound state
   * (e.g. mock-venue) may omit it.
   *
   * **Refresh-semantics fork (ADR-0038 D-3):** `refreshAddress()` re-keys the
   * **Viewing Address** sources only (spectate enter/leave). Wallet rotation
   * re-keys BOTH closures, so the composition root additionally calls
   * `refreshActingAddress()` from the same effect.
   */
  readonly refreshAddress?: () => void
  /**
   * Hint that the **Acting Address** callback may now return a different value
   * (wallet rotation). Re-keys the order-flow (`ownAccount`) account streams.
   * The composition root calls this alongside `refreshAddress()` on wallet
   * rotation, but NOT on spectate enter/leave (which must not re-key the acting
   * streams). Venues with no acting-keyed account state (e.g. mock-venue) may
   * omit it. See ADR-0038 D-3.
   */
  readonly refreshActingAddress?: () => void
  /**
   * Optional venue onboarding flow (sign-actions / route-fees etc). Absent
   * for venues that do not require any onboarding (e.g. mock-venue, master-
   * wallet-only venues). See ADR-0026.
   */
  readonly onboarding?: VenueOnboardingCapability
  /**
   * Optional in-app deposit flow (fund the venue without leaving the app).
   * Absent for venues that do not support an in-app deposit (e.g. mock-venue);
   * the capability-gated deposit trigger renders nothing in that case. The
   * venue owns its own deposit body — this port carries no venue specifics.
   * See the Hyperliquid deposit ADRs / PRD.
   */
  readonly deposit?: VenueDepositCapability
  /**
   * Optional in-app Spot↔Perp transfer flow. Absent for venues that do not
   * support an in-app transfer (e.g. mock-venue); the capability-gated transfer
   * trigger renders nothing in that case. Even when present, the trigger/sheet
   * additionally gate on `useTransfer().isApplicable` (false on unified /
   * portfolio-margin accounts). The venue owns its own transfer body. See
   * ADR-0033.
   */
  readonly transfer?: VenueTransferCapability
  /**
   * Optional in-app Withdraw flow (move USDC out of the venue to an L1/Arbitrum
   * address via withdraw3). Absent for venues without an in-app withdraw. The
   * venue owns its own withdraw body. Master-wallet-signed (ADR-0012).
   */
  readonly withdraw?: VenueWithdrawCapability
  /**
   * Optional in-app Send flow (move funds out of the venue to an external
   * Hyperliquid address — perp USDC via `usdSend`, a spot token via `spotSend`;
   * stays on Hyperliquid, no L1 bridge / flat fee). Absent for venues without
   * an in-app send. The venue owns its own send body. Master-wallet-signed
   * (ADR-0012).
   */
  readonly send?: VenueSendCapability
  /**
   * Optional in-app EVM⇄Core flow (move a spot token between the venue's L1 spot
   * state and its EVM chain — for Hyperliquid, HyperCore ⇄ HyperEVM). Absent for
   * venues without an in-app EVM⇄Core move (e.g. mock-venue). The venue owns its
   * own body. Core→EVM is master-signed (`spotSend` to the token's system
   * address, ADR-0012); EVM→Core is an on-chain HyperEVM transfer.
   */
  readonly evmCore?: VenueEvmCoreCapability
  /**
   * Optional HIP-3 (builder-deployed perp) abstraction capability. Present only
   * for venues that run HIP-3 markets with isolated per-DEX collateral (for
   * Hyperliquid). Lets a DEFAULT account opt into cross-DEX collateral
   * abstraction (one master-wallet signature) so HIP-3 markets stop rejecting
   * orders with "insufficient margin". Absent for venues without HIP-3 markets
   * (e.g. mock-venue); the shared `<Hip3AbstractionGateButton>` then always
   * passes through. See ADR-0081.
   */
  readonly hip3Abstraction?: VenueHip3AbstractionCapability
}
