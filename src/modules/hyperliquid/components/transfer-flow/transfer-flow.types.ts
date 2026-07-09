import type { TransferAccount, TransferError } from '../../providers/transfer-flow-provider'

export interface AccountDirectionProps {
  readonly from: TransferAccount
  readonly to: TransferAccount
  onSwap(): void
}

export interface TransferErrorCalloutProps {
  readonly reason: TransferError
  onRetry(): void
}
