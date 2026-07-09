import type {
  EvmCoreDirection,
  EvmCorePercent,
  EvmCoreToken,
  EvmPreflightStatus,
} from '../../providers/evm-core-flow-provider'
import type { FlowAssetsStatus } from '../shared-flow/shared-flow.types'

export interface EvmCoreDirectionToggleProps {
  readonly direction: EvmCoreDirection
  onSelect(direction: EvmCoreDirection): void
}

export interface EvmCoreFormProps {
  readonly direction: EvmCoreDirection
  readonly tokens: ReadonlyArray<EvmCoreToken>
  readonly selectedTokenKey: string
  readonly symbol: string
  readonly available: number
  readonly amount: string
  readonly isAmountValid: boolean
  readonly amountInvalidReason: string | null
  readonly canReview: boolean
  /** EVM-side preflight status — gates the EVM→Core form (checking/wrong-chain/no-gas). */
  readonly evmPreflight: EvmPreflightStatus
  /** Token-picker readiness (spot-meta loading / error / empty / ready). */
  readonly assetsStatus: FlowAssetsStatus
  onSelectDirection(direction: EvmCoreDirection): void
  onSelectToken(key: string): void
  onRetryAssets(): void
  onAmountChange(next: string): void
  onMax(): void
  onPercent(percent: EvmCorePercent): void
  onSwitchChain(): void
  onReview(): void
}

export interface EvmCorePreflightNoticeProps {
  readonly status: EvmPreflightStatus
  onSwitchChain(): void
}

export interface EvmCoreReviewProps {
  readonly direction: EvmCoreDirection
  readonly amount: string
  readonly symbol: string
  readonly isSigning: boolean
  onBack(): void
  onSign(): void
}

export interface EvmCoreSuccessProps {
  readonly direction: EvmCoreDirection
  readonly amount: string
  readonly symbol: string
  readonly explorerTxUrl: string | null
  onDone(): void
}
