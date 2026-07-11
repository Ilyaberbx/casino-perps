import { Wallet } from 'lucide-react'
import { useAccountModal } from '@/modules/account'
import styles from './center-top-bar.module.css'
import type { BalanceChipProps } from './center-top-bar.types'

/**
 * Read-only perp-equity chip beside the account avatar (desktop, signed in).
 * The balance is display-only — clicking opens the Account Modal (same target
 * as the avatar), never a trade action. Renders a shimmer while the first
 * portfolio snapshot is in flight, and nothing when there is no connected
 * wallet to read.
 */
export function BalanceChip({ label, isLoading }: BalanceChipProps) {
  const accountModal = useAccountModal()

  const hasNothingToShow = label === null && !isLoading
  if (hasNothingToShow) return null

  return (
    <button
      type="button"
      className={styles.balanceChip}
      onClick={accountModal.open}
      aria-label="Account balance"
      data-testid="header-balance"
    >
      <Wallet size={14} strokeWidth={2} aria-hidden="true" />
      {label ?? <span className={styles.balanceSkeleton} aria-hidden="true" />}
    </button>
  )
}
