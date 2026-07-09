export { createHyperliquidVenue } from './services/create-hyperliquid-venue'
// The agent signing wallet (`AbstractWallet`) type — bridged from
// `AgentWalletProvider` to the venue factory via the app-scope signing-wallet
// holder. Type only; no key material crosses the module boundary.
export type { HyperliquidAgentWallet } from './gateway'
export { loadHyperliquidConfig, type HyperliquidEnv } from './hyperliquid.config'
export {
  HYPERLIQUID_VENUE_ID,
  HYPERLIQUID_VENUE_LABEL,
} from './hyperliquid.constants'
export {
  type HyperliquidConfig,
  type HyperliquidNetwork,
  type HyperliquidConfigErrorKind,
  type HyperliquidVenueOptions,
  HyperliquidConfigError,
} from './hyperliquid.types'
export { AgentWalletProvider } from './providers/agent-wallet-provider'
export { useAgentWallet } from './providers/agent-wallet-provider'
export type { AgentWalletStatus, AgentApprovalErrorReason } from './providers/agent-wallet-provider/agent-wallet-provider.types'
export { AgentApprovalError } from './providers/agent-wallet-provider/agent-wallet-provider.types'
// AgentWalletContext exported for test injection (mirrors AuthContext export from account/)
export { AgentWalletContext } from './providers/agent-wallet-provider/agent-wallet-provider.context'
export type { AgentWalletState } from './providers/agent-wallet-provider/agent-wallet-provider.context'

// Builder fee approval (ADR-0024). Public surface mirrors AgentWalletProvider.
export { BuilderFeeProvider } from './providers/builder-fee-provider'
export { useBuilderFee } from './providers/builder-fee-provider'
export type {
  BuilderFeeStatus,
  BuilderFeeApprovalErrorReason,
} from './providers/builder-fee-provider/builder-fee-provider.types'
export { BuilderFeeApprovalError } from './providers/builder-fee-provider/builder-fee-provider.types'
export { BuilderFeeContext } from './providers/builder-fee-provider/builder-fee-provider.context'
export type { BuilderFeeState } from './providers/builder-fee-provider/builder-fee-provider.context'

// First Deposit milestone (DEP-05; reframed by ADR-0027). Public surface
// mirrors BuilderFeeProvider. DepositProvider bootstraps from
// gateway.queryHasEverFunded on session start (chain-derived "ever funded" —
// non-funding ledger is non-empty, not a live balance) and exposes recheck()
// (no signature — D-7 / Pitfall 4 read-only check).
export { DepositProvider } from './providers/deposit-provider'
export { useDeposit } from './providers/deposit-provider'
export type { DepositStatus, DepositErrorReason } from './providers/deposit-provider/deposit-provider.types'
export { DepositError } from './providers/deposit-provider/deposit-provider.types'
// DepositContext exported for test injection (mirrors BuilderFeeContext export)
export { DepositContext } from './providers/deposit-provider/deposit-provider.context'
export type { DepositState } from './providers/deposit-provider/deposit-provider.context'

// Hyperliquid onboarding port implementation (ADR-0026 / slice 5).
// Composes AgentWalletProvider + BuilderFeeProvider into a single
// `VenueOnboarding`-shaped value consumed by the generic onboarding sheet,
// banner, and gate button. The Hyperliquid venue exposes this pair as its
// `Venue.onboarding` capability — see `app/venues.ts`.
export {
  HyperliquidOnboardingProvider,
  useHyperliquidVenueOnboarding,
} from './providers/hyperliquid-onboarding-provider'
export type { HyperliquidVenueOnboarding } from './providers/hyperliquid-onboarding-provider'

// In-app deposit capability (ADR-0028 / .design/hyperliquid-deposit/, Chunk 3).
// The HL venue implements the venue-agnostic `VenueDepositCapability` port:
// `DepositFlowProvider` owns the `checking → … → credited` state machine,
// `DepositFlow` is the dumb body, and `useHyperliquidDeposit` projects the
// thin `DepositState { isComplete }`. `app/venues.ts` composes these into the
// `deposit` slot (mirrors how `onboarding` is layered on the plain factory).
export { DepositFlowProvider, useHyperliquidDeposit } from './providers/deposit-flow-provider'
export { DepositFlow } from './components/deposit-flow'

// In-app Spot↔Perp transfer capability (ADR-0033 / slice 04). The HL venue
// implements the venue-agnostic `VenueTransferCapability` port:
// `TransferFlowProvider` owns the `idle → signing → success | error` state
// machine, `TransferFlow` is the dumb body, and `useHyperliquidTransfer`
// projects the thin `TransferState { isApplicable, isComplete }`.
// `app/venues.ts` composes these into the `transfer` slot (mirrors `deposit`).
export { TransferFlowProvider, useHyperliquidTransfer } from './providers/transfer-flow-provider'
export { TransferFlow } from './components/transfer-flow'

// In-app Withdraw-to-Arbitrum capability (mirrors the transfer slice). The HL
// venue implements the venue-agnostic `VenueWithdrawCapability` port:
// `WithdrawFlowProvider` owns the `form → review → signing → sent | error` state
// machine, `WithdrawFlow` is the dumb body, and `useHyperliquidWithdraw`
// projects the thin `WithdrawState { isApplicable, isComplete }`. `app/venues.ts`
// composes these into the `withdraw` slot (mirrors `transfer`).
export { WithdrawFlowProvider, useHyperliquidWithdraw } from './providers/withdraw-flow-provider'
export { WithdrawFlow } from './components/withdraw-flow'

// In-app Send capability (usdSend perp USDC / spotSend a spot token to an
// external HL address; mirrors the withdraw slice + a token picker). The HL
// venue implements the venue-agnostic `VenueSendCapability` port:
// `SendFlowProvider` owns the `form → review → signing → sent | error` state
// machine + the self-wired sendable-token list, `SendFlow` is the dumb body, and
// `useHyperliquidSend` projects the thin `SendState { isApplicable, isComplete }`.
// `app/venues.ts` composes these into the `send` slot (mirrors `withdraw`).
export { SendFlowProvider, useHyperliquidSend } from './providers/send-flow-provider'
export { SendFlow } from './components/send-flow'

// In-app EVM⇄Core capability (move a spot token between HyperCore and HyperEVM).
// The HL venue implements the venue-agnostic `VenueEvmCoreCapability` port:
// `EvmCoreFlowProvider` owns the `form → review → signing → sent | error` state
// machine + the self-wired EVM-linked token list, `EvmCoreFlow` is the dumb body,
// and `useHyperliquidEvmCore` projects the thin `EvmCoreState { isApplicable,
// isComplete }`. `app/venues.ts` composes these into the `evmCore` slot. Slice 1
// ships the Core→EVM direction; EVM→Core lands in slice 2.
export { EvmCoreFlowProvider, useHyperliquidEvmCore } from './providers/evm-core-flow-provider'
export { EvmCoreFlow } from './components/evm-core-flow'

// `Hip3AbstractionProvider` owns the HIP-3 DEX-abstraction status + master-wallet
// `enable` action (ADR-0081); `useHyperliquidHip3Abstraction` is the venue-agnostic
// `Hip3AbstractionState` projection `app/venues.ts` composes into the
// `hip3Abstraction` slot so the shared `<Hip3AbstractionGateButton>` can unblock
// HIP-3 order entry for a default account.
export {
  Hip3AbstractionProvider,
  useHyperliquidHip3Abstraction,
} from './providers/hip3-abstraction-provider'

// The HyperEVM viem `Chain` for the build env (ADR-0069). Exported so the
// composition root's Privy `supportedChains` can allow HyperEVM (999/998) —
// without it Privy rejects the EVM⇄Core flow's `switchChain`/`addChain` and the
// "Switch to HyperEVM" button silently no-ops.
export { resolveHyperEvmChain } from './services/hyperevm.config'
