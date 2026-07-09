import type { Balance } from '@/modules/shared/domain'

export interface BalanceActionsCellProps {
  readonly balance: Balance
  canTransfer(balance: Balance): boolean
  onTransfer(balance: Balance): void
}
